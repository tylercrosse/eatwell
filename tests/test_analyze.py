from __future__ import annotations

import pytest

from app import openrouter
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
    async def fake(jpeg_bytes, settings):
        assert jpeg_bytes[:2] == b"\xff\xd8"  # received a normalized JPEG
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_food_image", fake)

    r = client.post("/api/analyze", files={"file": ("meal.jpg", sample_jpeg, "image/jpeg")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["photo_ref"].endswith(".jpg")
    assert body["analysis"]["total_calories"] == 280
    assert body["analysis"]["items"][0]["name"] == "Grilled chicken"


def test_analyze_rejects_non_image(client):
    r = client.post("/api/analyze", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_analyze_maps_upstream_failure_to_502(client, sample_jpeg, monkeypatch):
    async def boom(jpeg_bytes, settings):
        raise openrouter.EstimationError("model exploded")

    monkeypatch.setattr(openrouter, "analyze_food_image", boom)

    r = client.post("/api/analyze", files={"file": ("meal.jpg", sample_jpeg, "image/jpeg")})
    assert r.status_code == 502


def test_wrapper_requires_api_key():
    """The wrapper surfaces a domain EstimationError (not a raw SDK error) when unconfigured."""
    import asyncio

    from app.config import Settings

    settings = Settings(openrouter_api_key="")
    with pytest.raises(openrouter.EstimationError):
        asyncio.run(openrouter.analyze_food_image(b"\xff\xd8fake", settings))
