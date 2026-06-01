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


def test_create_with_meal_round_trips(client):
    # Catches a missing `meal` in EntryRead: it would be stored but never returned.
    created = _make(client, meal="lunch")
    assert created["meal"] == "lunch"
    assert client.get(f"/api/entries/{created['id']}").json()["meal"] == "lunch"


def test_create_without_meal_is_null(client):
    assert _make(client)["meal"] is None


def test_patch_meal_only(client):
    created = _make(client)
    r = client.patch(f"/api/entries/{created['id']}", json={"meal": "dinner"})
    assert r.status_code == 200
    assert r.json()["meal"] == "dinner"
    assert r.json()["food_name"] == "Eggs"  # untouched


def test_create_rejects_unknown_meal(client):
    r = client.post(
        "/api/entries",
        json={"food_name": "Brunch thing", "meal": "brunch"},
    )
    assert r.status_code == 422


def test_nutrition_fields_round_trip(client):
    created = _make(client, weight_g=300, fiber_g=5, sugar_g=12, sodium_mg=400)
    assert created["weight_g"] == 300
    assert created["fiber_g"] == 5
    got = client.get(f"/api/entries/{created['id']}").json()
    assert got["sugar_g"] == 12
    assert got["sodium_mg"] == 400


def test_nutrition_fields_default_null(client):
    created = _make(client)
    assert created["weight_g"] is None
    assert created["fiber_g"] is None
    assert created["sugar_g"] is None
    assert created["sodium_mg"] is None


def test_patch_weight_only(client):
    created = _make(client)
    r = client.patch(f"/api/entries/{created['id']}", json={"weight_g": 250})
    assert r.status_code == 200
    assert r.json()["weight_g"] == 250
    assert r.json()["calories"] == 200  # untouched


def test_patch_logged_at_moves_entry_to_another_day(client):
    created = _make(client, logged_at="2026-05-31T08:30:00")
    r = client.patch(f"/api/entries/{created['id']}", json={"logged_at": "2026-05-29T20:00:00"})
    assert r.status_code == 200
    assert r.json()["logged_at"] == "2026-05-29T20:00:00"
    # The entry now lists under the new day, not the old one.
    assert client.get("/api/entries", params={"date": "2026-05-31"}).json() == []
    moved = client.get("/api/entries", params={"date": "2026-05-29"}).json()
    assert [e["id"] for e in moved] == [created["id"]]


def test_range_aggregates_per_day(client):
    _make(client, calories=200, logged_at="2026-05-31T08:00:00")
    _make(client, food_name="Rice", calories=300, logged_at="2026-05-31T12:00:00")
    _make(client, food_name="Toast", calories=150, logged_at="2026-06-01T08:00:00")

    rows = client.get("/api/entries/range", params={"from": "2026-05-31", "to": "2026-06-01"}).json()
    assert [r["date"] for r in rows] == ["2026-05-31", "2026-06-01"]  # ascending, sparse
    assert rows[0]["entry_count"] == 2
    assert rows[0]["total_calories"] == 500
    assert rows[1]["total_calories"] == 150
