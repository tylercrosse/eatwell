from __future__ import annotations


def _log(client, name, **overrides):
    payload = {"food_name": name, "calories": 100, "logged_at": "2026-05-31T08:00:00"}
    payload.update(overrides)
    r = client.post("/api/entries", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_recent_foods_empty(client):
    assert client.get("/api/foods/recent").json() == []


def test_recent_foods_dedupes_by_name_keeping_latest(client):
    _log(client, "Oatmeal", calories=300, logged_at="2026-05-30T08:00:00")
    _log(client, "Oatmeal", calories=350, logged_at="2026-05-31T08:00:00")  # newer
    _log(client, "Banana", calories=100, logged_at="2026-05-31T09:00:00")

    recent = client.get("/api/foods/recent").json()
    names = [f["food_name"] for f in recent]
    assert names.count("Oatmeal") == 1
    assert names[0] == "Banana"  # newest overall first
    oatmeal = next(f for f in recent if f["food_name"] == "Oatmeal")
    assert oatmeal["calories"] == 350  # latest entry wins


def test_recent_foods_case_insensitive_dedupe(client):
    _log(client, "Coffee", logged_at="2026-05-31T07:00:00")
    _log(client, "coffee", logged_at="2026-05-31T08:00:00")
    assert len(client.get("/api/foods/recent").json()) == 1


def test_recent_foods_q_filter(client):
    _log(client, "Greek yogurt")
    _log(client, "Banana")
    recent = client.get("/api/foods/recent", params={"q": "yog"}).json()
    assert [f["food_name"] for f in recent] == ["Greek yogurt"]


def test_recent_foods_limit(client):
    for i in range(5):
        _log(client, f"Food {i}", logged_at=f"2026-05-31T0{i}:00:00")
    assert len(client.get("/api/foods/recent", params={"limit": 3}).json()) == 3


def test_recent_foods_carries_nutrition(client):
    _log(client, "Salad", weight_g=250, fiber_g=6)
    recent = client.get("/api/foods/recent").json()
    assert recent[0]["weight_g"] == 250
    assert recent[0]["fiber_g"] == 6
