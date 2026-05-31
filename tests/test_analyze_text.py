from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest

from app import openrouter, usda
from app.config import Settings
from app.schemas import AnalysisResult, FoodItem

_FAKE = AnalysisResult(
    items=[FoodItem(name="Iced latte", calories=120, protein_g=6, carbs_g=10, fat_g=6)],
    total_calories=120,
    total_protein_g=6,
    total_carbs_g=10,
    total_fat_g=6,
    serving_size_estimate="12 oz (355 ml)",
    confidence=0.6,
)


def test_analyze_text_success(client, monkeypatch):
    async def fake(description, settings):
        assert description == "12 oz iced latte"
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_food_text", fake)

    r = client.post("/api/analyze/text", json={"description": "12 oz iced latte"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_calories"] == 120
    assert body["items"][0]["name"] == "Iced latte"


def test_analyze_text_trims_description(client, monkeypatch):
    seen: dict[str, str] = {}

    async def fake(description, settings):
        seen["description"] = description
        return _FAKE

    monkeypatch.setattr(openrouter, "analyze_food_text", fake)

    r = client.post("/api/analyze/text", json={"description": "  small gelato  "})
    assert r.status_code == 200, r.text
    assert seen["description"] == "small gelato"


def test_analyze_text_rejects_empty(client):
    r = client.post("/api/analyze/text", json={"description": "   "})
    assert r.status_code == 400


def test_analyze_text_maps_upstream_failure_to_502(client, monkeypatch):
    async def boom(description, settings):
        raise openrouter.EstimationError("model exploded")

    monkeypatch.setattr(openrouter, "analyze_food_text", boom)

    r = client.post("/api/analyze/text", json={"description": "small gelato"})
    assert r.status_code == 502


def test_text_wrapper_requires_api_key():
    """The wrapper surfaces a domain EstimationError (not a raw SDK error) when unconfigured."""
    settings = Settings(openrouter_api_key="")
    with pytest.raises(openrouter.EstimationError):
        asyncio.run(openrouter.analyze_food_text("gelato", settings))


# --- Tool-loop orchestration (fake OpenAI client) --------------------------


def _msg(content=None, tool_calls=None):
    return SimpleNamespace(content=content, tool_calls=tool_calls)


def _resp(message):
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _tool_call(call_id, name, arguments):
    return SimpleNamespace(id=call_id, function=SimpleNamespace(name=name, arguments=arguments))


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


def test_analyze_food_text_runs_tool_loop(monkeypatch):
    """Model asks to search, we feed USDA results back, then it emits the final JSON."""
    script = [
        _resp(_msg(tool_calls=[_tool_call("c1", "search_foods", json.dumps({"query": "gelato"}))])),
        _resp(_msg(content="all set", tool_calls=None)),
        _resp(_msg(content=_FAKE.model_dump_json())),
    ]
    fake_client = _FakeClient(script)
    monkeypatch.setattr(openrouter, "_client", lambda settings: fake_client)

    searched: list[str] = []

    async def fake_search(query, settings):
        searched.append(query)
        return [usda.FoodMatch("Gelato", "Branded", 200, 4, 30, 8, "100 g")]

    monkeypatch.setattr(usda, "search_foods", fake_search)

    settings = Settings(openrouter_api_key="k", usda_api_key="u")
    result = asyncio.run(openrouter.analyze_food_text("small gelato", settings))

    assert result.total_calories == _FAKE.total_calories
    assert searched == ["gelato"]
    calls = fake_client.chat.completions.calls
    assert len(calls) == 3  # 2 tool-loop turns + 1 final structured call
    # Tool turns offer the tool; the final turn requests strict JSON without tools.
    assert "tools" in calls[0]
    assert "response_format" in calls[-1]
    assert "tools" not in calls[-1]


def test_analyze_food_text_pure_llm_when_no_usda_key(monkeypatch):
    """With no USDA key, skip the tool loop and make a single structured call."""
    fake_client = _FakeClient([_resp(_msg(content=_FAKE.model_dump_json()))])
    monkeypatch.setattr(openrouter, "_client", lambda settings: fake_client)

    called: list[str] = []

    async def fake_search(query, settings):
        called.append(query)
        return []

    monkeypatch.setattr(usda, "search_foods", fake_search)

    settings = Settings(openrouter_api_key="k", usda_api_key="")
    result = asyncio.run(openrouter.analyze_food_text("gelato", settings))

    assert result.total_calories == _FAKE.total_calories
    assert called == []  # grounding skipped
    calls = fake_client.chat.completions.calls
    assert len(calls) == 1
    assert "response_format" in calls[0]
    assert "tools" not in calls[0]
