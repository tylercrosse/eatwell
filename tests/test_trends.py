from __future__ import annotations

from datetime import date, datetime

from sqlmodel import Session

from app.db import engine
from app.models import BodyMetric, ExerciseEntry, FoodEntry


def _food(client, **overrides):
    payload = {
        "food_name": "Eggs",
        "calories": 200,
        "protein_g": 14,
        "carbs_g": 1,
        "fat_g": 15,
        "logged_at": "2026-05-31T08:30:00",
    }
    payload.update(overrides)
    r = client.post("/api/entries", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _exercise(client, **overrides):
    payload = {"description": "Easy jog", "calories": 200, "duration_min": 20, "date": "2026-05-31"}
    payload.update(overrides)
    r = client.post("/api/exercise", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_history_aggregates_all_owned_data_through_day(client):
    _food(client, calories=200, logged_at="2026-05-31T08:30:00")
    _food(client, food_name="Rice", calories=300, logged_at="2026-05-31T12:00:00")
    _food(client, food_name="Toast", calories=150, logged_at="2026-06-01T08:00:00")
    _food(client, food_name="Future", calories=999, logged_at="2026-06-18T08:00:00")
    _exercise(client, calories=120, date="2026-05-30")
    _exercise(client, description="Swim", calories=350, date="2026-06-01")
    assert client.post("/api/metrics", json={"date": "2026-05-29", "weight_kg": 80, "steps": 8000}).status_code == 200

    body = client.get("/api/trends/history", params={"to": "2026-06-17"}).json()

    assert body["start_date"] == "2026-05-29"
    assert body["end_date"] == "2026-06-17"
    assert [row["date"] for row in body["entries"]] == ["2026-05-31", "2026-06-01"]
    assert body["entries"][0]["entry_count"] == 2
    assert body["entries"][0]["total_calories"] == 500
    assert [row["date"] for row in body["exercise"]] == ["2026-05-30", "2026-06-01"]
    assert body["exercise"][0]["total_calories"] == 120
    assert [row["date"] for row in body["metrics"]] == ["2026-05-29"]
    assert body["metrics"][0]["steps"] == 8000


def test_history_empty_falls_back_to_trailing_30_day_axis(client):
    body = client.get("/api/trends/history", params={"to": "2026-06-17"}).json()

    assert body == {
        "start_date": "2026-05-19",
        "end_date": "2026-06-17",
        "entries": [],
        "exercise": [],
        "metrics": [],
    }


def test_history_is_user_scoped(client):
    _food(client, calories=200, logged_at="2026-06-01T08:00:00")
    with Session(engine) as session:
        session.add(
            FoodEntry(
                user_id=2,
                logged_at=datetime(2026, 5, 1, 8, 0),
                food_name="Other user food",
                calories=999,
            )
        )
        session.add(ExerciseEntry(user_id=2, date=date(2026, 5, 2), description="Other run", calories=500))
        session.add(BodyMetric(user_id=2, date=date(2026, 5, 3), weight_kg=70))
        session.commit()

    body = client.get("/api/trends/history", params={"to": "2026-06-17"}).json()

    assert body["start_date"] == "2026-06-01"
    assert [row["date"] for row in body["entries"]] == ["2026-06-01"]
    assert body["entries"][0]["total_calories"] == 200
    assert body["exercise"] == []
    assert body["metrics"] == []
