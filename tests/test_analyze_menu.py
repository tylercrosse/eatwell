from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app import openrouter
from app.config import Settings
from app.schemas import MENU_ANALYSIS_JSON_SCHEMA, MENU_SCAN_OPTION_LIMIT, MenuAnalysisResult, MenuOption

_FAKE = MenuAnalysisResult(
    restaurant_name="Cafe Test",
    options=[
        MenuOption(
            name="Grilled chicken salad",
            description="Mixed greens with grilled chicken",
            section="Salads",
            price="$14",
            source_text="Grilled chicken salad - mixed greens - $14",
            calories=420,
            protein_g=38,
            carbs_g=22,
            fat_g=18,
            weight_g=420,
            fiber_g=7,
            sugar_g=8,
            sodium_mg=780,
            is_beverage=False,
            serving_size_estimate="1 entree salad (~420g)",
            confidence=0.74,
        )
    ],
    confidence=0.72,
)


def test_analyze_menu_success(client, sample_jpeg, monkeypatch):
    async def fake(jpeg_bytes, settings):
        assert jpeg_bytes[:2] == b"\xff\xd8"  # received a normalized JPEG
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_menu_image", fake)

    r = client.post("/api/analyze/menu", files={"file": ("menu.jpg", sample_jpeg, "image/jpeg")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["restaurant_name"] == "Cafe Test"
    assert body["options"][0]["name"] == "Grilled chicken salad"
    assert body["options"][0]["protein_g"] == 38
    assert "photo_ref" not in body  # menu scans are stateless and do not save uploads


def test_analyze_menu_rejects_non_image(client):
    r = client.post("/api/analyze/menu", files={"file": ("menu.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_analyze_menu_maps_upstream_failure_to_502(client, sample_jpeg, monkeypatch):
    async def boom(jpeg_bytes, settings):
        raise openrouter.EstimationError("model exploded")

    monkeypatch.setattr(openrouter, "analyze_menu_image", boom)

    r = client.post("/api/analyze/menu", files={"file": ("menu.jpg", sample_jpeg, "image/jpeg")})
    assert r.status_code == 502


def test_menu_wrapper_requires_api_key():
    settings = Settings(openrouter_api_key="")
    with pytest.raises(openrouter.EstimationError):
        asyncio.run(openrouter.analyze_menu_image(b"\xff\xd8fake", settings))


def test_menu_schema_omits_provider_incompatible_max_items():
    assert MENU_SCAN_OPTION_LIMIT == 24
    assert "maxItems" not in MENU_ANALYSIS_JSON_SCHEMA["properties"]["options"]


def test_menu_schema_describes_section_heading_extraction():
    description = (
        MENU_ANALYSIS_JSON_SCHEMA["properties"]["options"]["items"]["properties"]["section"]["description"].lower()
    )

    assert "nearest visible menu section" in description
    assert "empty only when no heading is visible" in description


def test_menu_result_rejects_more_than_option_limit():
    options = [
        _FAKE.options[0].model_copy(update={"name": f"Menu item {i}"})
        for i in range(MENU_SCAN_OPTION_LIMIT + 1)
    ]

    with pytest.raises(ValidationError):
        MenuAnalysisResult(restaurant_name="Cafe Test", options=options, confidence=0.7)


def test_parse_menu_analysis_truncates_overlong_model_output():
    options = [
        _FAKE.options[0].model_copy(update={"name": f"Menu item {i}"})
        for i in range(MENU_SCAN_OPTION_LIMIT + 1)
    ]
    payload = MenuAnalysisResult.model_construct(
        restaurant_name="Cafe Test",
        options=options,
        confidence=0.7,
    ).model_dump_json()

    parsed = openrouter._parse_menu_analysis(payload)

    assert len(parsed.options) == MENU_SCAN_OPTION_LIMIT
    assert parsed.options[-1].name == f"Menu item {MENU_SCAN_OPTION_LIMIT - 1}"


def test_analyze_menu_image_parses_strict_schema(monkeypatch):
    fake_client = _FakeClient([_resp(_msg(content=_FAKE.model_dump_json()))])
    monkeypatch.setattr(openrouter, "_client", lambda settings: fake_client)

    settings = Settings(openrouter_api_key="k")
    result = asyncio.run(openrouter.analyze_menu_image(b"\xff\xd8fake", settings))

    assert result.options[0].name == "Grilled chicken salad"
    call = fake_client.chat.completions.calls[0]
    assert call["response_format"]["json_schema"]["name"] == "menu_analysis"
    assert call["response_format"]["json_schema"]["strict"] is True
    assert "nearest preceding visible section heading" in call["messages"][0]["content"]


def test_analyze_menu_image_rejects_malformed_model_output(monkeypatch):
    fake_client = _FakeClient([_resp(_msg(content='{"restaurant_name":"Cafe","options":[]}'))])
    monkeypatch.setattr(openrouter, "_client", lambda settings: fake_client)

    settings = Settings(openrouter_api_key="k")
    with pytest.raises(openrouter.EstimationError):
        asyncio.run(openrouter.analyze_menu_image(b"\xff\xd8fake", settings))


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
