from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app import openrouter
from app.config import Settings
from app.schemas import AnalysisResult, FoodItem

_FAKE = AnalysisResult(
    items=[FoodItem(name="Grilled chicken", calories=280, protein_g=52, carbs_g=0, fat_g=6)],
    total_calories=280,
    total_protein_g=52,
    total_carbs_g=0,
    total_fat_g=6,
    serving_size_estimate="1 breast (~150g)",
    confidence=0.72,
)


def test_analyze_success(client, sample_jpeg, monkeypatch):
    async def fake(jpeg_bytes, settings, context=None):
        assert jpeg_bytes[:2] == b"\xff\xd8"  # received a normalized JPEG
        assert context is None
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_food_image", fake)

    r = client.post("/api/analyze", files={"file": ("meal.jpg", sample_jpeg, "image/jpeg")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["photo_ref"].endswith(".jpg")
    assert body["analysis"]["total_calories"] == 280
    assert body["analysis"]["items"][0]["name"] == "Grilled chicken"


def test_analyze_trims_optional_description(client, sample_jpeg, monkeypatch):
    seen: dict[str, str | None] = {}

    async def fake(jpeg_bytes, settings, context=None):
        seen["context"] = context
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_food_image", fake)

    r = client.post(
        "/api/analyze",
        data={"description": "  bowl with extra sauce  "},
        files={"file": ("meal.jpg", sample_jpeg, "image/jpeg")},
    )
    assert r.status_code == 200, r.text
    assert seen["context"] == "bowl with extra sauce"


def test_analyze_rejects_non_image(client):
    r = client.post("/api/analyze", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_analyze_maps_upstream_failure_to_502(client, sample_jpeg, monkeypatch):
    async def boom(jpeg_bytes, settings, context=None):
        raise openrouter.EstimationError("model exploded")

    monkeypatch.setattr(openrouter, "analyze_food_image", boom)

    r = client.post("/api/analyze", files={"file": ("meal.jpg", sample_jpeg, "image/jpeg")})
    assert r.status_code == 502


def test_wrapper_requires_api_key():
    """The wrapper surfaces a domain EstimationError (not a raw SDK error) when unconfigured."""
    settings = Settings(openrouter_api_key="")
    with pytest.raises(openrouter.EstimationError):
        asyncio.run(openrouter.analyze_food_image(b"\xff\xd8fake", settings))


def _msg(content=None):
    return SimpleNamespace(content=content)


def _resp(message):
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class _FakeCompletions:
    def __init__(self, script):
        self._script = list(script)
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._script.pop(0)


class _FakeClient:
    def __init__(self, script):
        self.chat = SimpleNamespace(completions=_FakeCompletions(script))


def test_image_wrapper_includes_context_when_provided(monkeypatch):
    fake_client = _FakeClient([_resp(_msg(content=_FAKE.model_dump_json()))])
    monkeypatch.setattr(openrouter, "_client", lambda settings: fake_client)

    settings = Settings(openrouter_api_key="k")
    result = asyncio.run(openrouter.analyze_food_image(b"image", settings, "  extra rice  "))

    assert result.total_calories == _FAKE.total_calories
    text = fake_client.chat.completions.calls[0]["messages"][1]["content"][0]["text"]
    assert "Analyze this meal and estimate its nutrition." in text
    assert "User context: extra rice" in text


def test_image_wrapper_omits_empty_context(monkeypatch):
    fake_client = _FakeClient([_resp(_msg(content=_FAKE.model_dump_json()))])
    monkeypatch.setattr(openrouter, "_client", lambda settings: fake_client)

    settings = Settings(openrouter_api_key="k")
    asyncio.run(openrouter.analyze_food_image(b"image", settings, "   "))

    text = fake_client.chat.completions.calls[0]["messages"][1]["content"][0]["text"]
    assert "User context:" not in text
