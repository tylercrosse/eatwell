from __future__ import annotations


def _make(client, **overrides):
    payload = {"description": "Easy jog", "calories": 200, "duration_min": 20, "date": "2026-05-31"}
    payload.update(overrides)
    r = client.post("/api/exercise", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_list_by_date(client):
    created = _make(client)
    assert created["id"] > 0
    assert created["calories"] == 200
    rows = client.get("/api/exercise", params={"date": "2026-05-31"}).json()
    assert [r["id"] for r in rows] == [created["id"]]


def test_list_filters_by_date(client):
    _make(client, date="2026-05-31")
    _make(client, description="Walk", date="2026-06-01")
    rows = client.get("/api/exercise", params={"date": "2026-06-01"}).json()
    assert [r["description"] for r in rows] == ["Walk"]


def test_defaults_date_to_today_when_omitted(client):
    r = client.post("/api/exercise", json={"description": "Pushups", "calories": 50})
    assert r.status_code == 201
    assert r.json()["date"]  # populated by the server


def test_patch_and_delete(client):
    created = _make(client)
    r = client.patch(f"/api/exercise/{created['id']}", json={"calories": 333})
    assert r.status_code == 200
    assert r.json()["calories"] == 333
    assert r.json()["description"] == "Easy jog"  # untouched
    assert client.delete(f"/api/exercise/{created['id']}").status_code == 204
    assert client.get("/api/exercise", params={"date": "2026-05-31"}).json() == []


def test_delete_missing_404(client):
    assert client.delete("/api/exercise/999").status_code == 404


def test_range_aggregates_per_day(client):
    _make(client, calories=200, date="2026-05-31")
    _make(client, description="Walk", calories=120, date="2026-05-31")
    _make(client, description="Swim", calories=350, date="2026-06-01")

    rows = client.get("/api/exercise/range", params={"from": "2026-05-31", "to": "2026-06-01"}).json()
    assert [r["date"] for r in rows] == ["2026-05-31", "2026-06-01"]  # ascending, sparse
    assert rows[0]["entry_count"] == 2
    assert rows[0]["total_calories"] == 320
    assert rows[1]["total_calories"] == 350


def test_range_excludes_days_outside_window(client):
    _make(client, calories=200, date="2026-05-30")  # before window
    _make(client, calories=200, date="2026-06-02")  # after window
    _make(client, calories=99, date="2026-06-01")  # in window

    rows = client.get("/api/exercise/range", params={"from": "2026-05-31", "to": "2026-06-01"}).json()
    assert [r["date"] for r in rows] == ["2026-06-01"]
    assert rows[0]["total_calories"] == 99


def test_range_empty_when_no_exercise(client):
    rows = client.get("/api/exercise/range", params={"from": "2026-05-31", "to": "2026-06-01"}).json()
    assert rows == []
