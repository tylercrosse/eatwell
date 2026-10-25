from __future__ import annotations

import asyncio
import re
from types import SimpleNamespace

import pytest

from evals import photo_eval
from evals.photo_eval import CaseResult


def _result(case_id, truth_kcal, pred_kcal, group=None, tier="nutrition5k", category="salad"):
    truth = {"calories": truth_kcal, "protein_g": 10, "carbs_g": 20, "fat_g": 5, "weight_g": 200}
    predicted = None
    if pred_kcal is not None:
        predicted = {"calories": pred_kcal, "protein_g": 12, "carbs_g": 20, "fat_g": 2, "weight_g": 300}
    return CaseResult(case_id, tier, category, group, truth, predicted, latency_s=1.0, confidence=0.5)


def test_summary_metrics():
    s = photo_eval._summarize([_result("a", 100, 120), _result("b", 200, 150), _result("c", 50, None)])
    assert s["n"] == 3 and s["failures"] == 1
    assert s["calorie_mape"] == pytest.approx(22.5)  # (20 + 25) / 2
    assert s["calorie_bias_pct"] == pytest.approx(-2.5)  # (+20 - 25) / 2
    assert s["within_20pct"] == 0.5
    assert s["protein_g_mae"] == 2 and s["fat_g_mae"] == 3
    assert s["weight_mape"] == 50


def test_portion_scaling_flags_under_reaction():
    rows = photo_eval.portion_scaling(
        [
            _result("small", 100, 300, group="g1"),
            _result("large", 400, 450, group="g1"),  # food grew 4x, estimate only 1.5x
            _result("lonely", 100, 100, group="g2"),  # partner failed -> skipped
        ]
    )
    assert rows == [
        {"group": "g1", "true_ratio": 4.0, "predicted_ratio": 1.5, "scaling": 0.38, "direction_correct": True}
    ]


def test_score_groups_by_tier_and_category():
    scores = photo_eval.score(
        [_result("a", 100, 100), _result("b", 100, 200, tier="restaurant", category="burger")]
    )
    assert set(scores["by_tier"]) == {"nutrition5k", "restaurant"}
    assert scores["by_category"]["burger"]["calorie_mape"] == 100
    assert scores["portion_scaling_median"] is None


def test_usage_capture_records_tokens_and_cost():
    usage = SimpleNamespace(
        prompt_tokens=1200, completion_tokens=300, cost=0.0015,
        completion_tokens_details=SimpleNamespace(reasoning_tokens=100),
    )

    async def fake_create(**kwargs):
        return SimpleNamespace(usage=usage)

    def make_client(settings):
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create)))

    async def call():
        holder: dict = {}
        photo_eval._usage_holder.set(holder)
        client = photo_eval._usage_capturing_client(make_client)(None)
        await client.chat.completions.create(model="m")
        return holder

    assert asyncio.run(call()) == {
        "prompt_tokens": 1200, "completion_tokens": 300, "reasoning_tokens": 100, "cost_usd": 0.0015
    }


def test_cases_file_is_well_formed():
    cases = photo_eval.load_cases()
    assert len({c.id for c in cases}) == len(cases)
    groups: dict[str, int] = {}
    for c in cases:
        assert c.tier in {"nutrition5k", "restaurant", "local"}
        assert re.fullmatch(r"[0-9a-f]{64}", c.image["sha256"])
        if c.tier != "local":
            assert c.image["url"].startswith("https://") and c.image["license"]
        assert c.truth["calories"] > 0
        assert all(c.truth[m] >= 0 for m in photo_eval.MACROS)
        if c.portion_group:
            groups[c.portion_group] = groups.get(c.portion_group, 0) + 1
    assert groups and all(n == 2 for n in groups.values())
