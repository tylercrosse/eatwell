from __future__ import annotations

from app.db import engine
from app.models import Targets
from sqlmodel import Session, select

VALID = {"calorie_target": 1800, "protein_pct": 35, "carbs_pct": 40, "fat_pct": 25}


def test_get_returns_defaults_when_unset(client):
    body = client.get("/api/targets").json()
    assert body == {
        "calorie_target": 2000.0,
        "protein_pct": 30.0,
        "carbs_pct": 40.0,
        "fat_pct": 30.0,
        "goal_weight_kg": None,
        "goal_body_fat_pct": None,
        "weekly_rate_kg": None,
        "height_cm": None,
        "birth_year": None,
        "sex": None,
        "activity_factor": None,
    }


def test_put_then_get_round_trips(client):
    r = client.put("/api/targets", json=VALID)
    assert r.status_code == 200, r.text

    got = client.get("/api/targets").json()
    assert got["calorie_target"] == 1800
    assert got["protein_pct"] == 35
    assert got["carbs_pct"] == 40
    assert got["fat_pct"] == 25


def test_put_upserts_single_row(client):
    client.put("/api/targets", json=VALID)
    client.put("/api/targets", json={**VALID, "calorie_target": 2200})

    assert client.get("/api/targets").json()["calorie_target"] == 2200
    with Session(engine) as s:
        assert len(s.exec(select(Targets)).all()) == 1  # no row proliferation


def test_put_rejects_split_not_summing_to_100(client):
    bad = {"calorie_target": 2000, "protein_pct": 30, "carbs_pct": 30, "fat_pct": 30}
    assert client.put("/api/targets", json=bad).status_code == 422


def test_put_rejects_negative(client):
    bad = {"calorie_target": -5, "protein_pct": 30, "carbs_pct": 40, "fat_pct": 30}
    assert client.put("/api/targets", json=bad).status_code == 422
