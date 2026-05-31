from __future__ import annotations


def _make(client, **overrides):
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


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_create_and_get(client):
    created = _make(client)
    assert created["id"] > 0
    assert created["logged_at"] == "2026-05-31T08:30:00"  # naive, round-trips unchanged

    got = client.get(f"/api/entries/{created['id']}")
    assert got.status_code == 200
    assert got.json()["food_name"] == "Eggs"


def test_logged_at_defaults_to_now_when_omitted(client):
    r = client.post("/api/entries", json={"food_name": "Snack", "calories": 50})
    assert r.status_code == 201
    assert r.json()["logged_at"]  # populated by the server


def test_list_filters_by_date(client):
    _make(client, logged_at="2026-05-31T08:30:00")
    _make(client, food_name="Toast", logged_at="2026-06-01T08:30:00")

    only_may = client.get("/api/entries", params={"date": "2026-05-31"}).json()
    assert {e["food_name"] for e in only_may} == {"Eggs"}


def test_day_summary_totals(client):
    _make(client, calories=200, protein_g=14, carbs_g=1, fat_g=15)
    _make(client, food_name="Rice", calories=300, protein_g=6, carbs_g=65, fat_g=1)

    s = client.get("/api/entries/summary", params={"date": "2026-05-31"}).json()
    assert s["entry_count"] == 2
    assert s["total_calories"] == 500
    assert s["total_carbs_g"] == 66


def test_patch_updates_fields(client):
    created = _make(client)
    r = client.patch(f"/api/entries/{created['id']}", json={"calories": 999})
    assert r.status_code == 200
    assert r.json()["calories"] == 999
    assert r.json()["food_name"] == "Eggs"  # untouched


def test_delete_then_404(client):
    created = _make(client)
    assert client.delete(f"/api/entries/{created['id']}").status_code == 204
    assert client.get(f"/api/entries/{created['id']}").status_code == 404
    assert client.delete(f"/api/entries/{created['id']}").status_code == 404
