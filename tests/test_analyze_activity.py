from __future__ import annotations

from app import openrouter
from app.schemas import ActivityResult

_FAKE = ActivityResult(name="Light jog", duration_min=20, calories=180, confidence=0.6)


def test_activity_success(client, monkeypatch):
    async def fake(description, weight_kg, settings):
        assert description == "20 min light jog"
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_activity_text", fake)
    r = client.post("/api/analyze/activity", json={"description": "20 min light jog"})
    assert r.status_code == 200, r.text
    assert r.json()["calories"] == 180
    assert r.json()["name"] == "Light jog"


def test_activity_passes_latest_weight(client, monkeypatch):
    client.post("/api/metrics", json={"date": "2026-05-30", "weight_kg": 70})
    client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 72})  # latest
    seen: dict[str, float | None] = {}

    async def fake(description, weight_kg, settings):
        seen["weight"] = weight_kg
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_activity_text", fake)
    client.post("/api/analyze/activity", json={"description": "run"})
    assert seen["weight"] == 72


def test_activity_rejects_empty(client):
    assert client.post("/api/analyze/activity", json={"description": "  "}).status_code == 400


def test_activity_maps_upstream_failure_to_502(client, monkeypatch):
    async def boom(description, weight_kg, settings):
        raise openrouter.EstimationError("boom")

    monkeypatch.setattr(openrouter, "analyze_activity_text", boom)
    assert client.post("/api/analyze/activity", json={"description": "run"}).status_code == 502
