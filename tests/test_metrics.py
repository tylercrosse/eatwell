from __future__ import annotations


def test_log_weight(client):
    r = client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 80.5})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["date"] == "2026-05-31"
    assert body["weight_kg"] == 80.5
    assert body["body_fat_pct"] is None


def test_requires_at_least_one_measure(client):
    r = client.post("/api/metrics", json={"date": "2026-05-31", "note": "nothing"})
    assert r.status_code == 422


def test_post_upserts_one_row_per_day(client):
    client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 80.0})
    client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 79.5})
    rows = client.get("/api/metrics").json()
    assert len(rows) == 1
    assert rows[0]["weight_kg"] == 79.5  # latest wins


def test_partial_update_preserves_other_field(client):
    client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 80.0, "body_fat_pct": 20.0})
    client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 79.0})  # weight only
    row = client.get("/api/metrics").json()[0]
    assert row["weight_kg"] == 79.0
    assert row["body_fat_pct"] == 20.0  # not wiped


def test_range_filter_and_order(client):
    for day in ("2026-05-29", "2026-05-31", "2026-05-30"):
        client.post("/api/metrics", json={"date": day, "weight_kg": 80})
    rows = client.get("/api/metrics", params={"from": "2026-05-30", "to": "2026-05-31"}).json()
    assert [r["date"] for r in rows] == ["2026-05-30", "2026-05-31"]  # filtered + ascending


def test_delete_metric(client):
    created = client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 80}).json()
    assert client.delete(f"/api/metrics/{created['id']}").status_code == 204
    assert client.get("/api/metrics").json() == []


def test_latest_metric_returns_most_recent_weight(client):
    client.post("/api/metrics", json={"date": "2026-05-29", "weight_kg": 80})
    client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 79})
    client.post("/api/metrics", json={"date": "2026-06-01", "body_fat_pct": 18})  # no weight
    latest = client.get("/api/metrics/latest").json()
    assert latest["weight_kg"] == 79  # most recent row that has a weight (05-31)
    assert latest["date"] == "2026-05-31"


def test_latest_metric_null_when_no_weight(client):
    assert client.get("/api/metrics/latest").json() is None
    client.post("/api/metrics", json={"date": "2026-05-31", "steps": 5000})  # steps only
    assert client.get("/api/metrics/latest").json() is None


def test_patch_clears_steps_keeps_weight(client):
    created = client.post("/api/metrics", json={"date": "2026-05-31", "weight_kg": 80, "steps": 8000}).json()
    r = client.patch(f"/api/metrics/{created['id']}", json={"steps": None})
    assert r.status_code == 200
    assert r.json()["steps"] is None
    assert r.json()["weight_kg"] == 80  # preserved


def test_patch_updates_steps(client):
    created = client.post("/api/metrics", json={"date": "2026-05-31", "steps": 5000}).json()
    r = client.patch(f"/api/metrics/{created['id']}", json={"steps": 9000})
    assert r.status_code == 200
    assert r.json()["steps"] == 9000


def test_patch_missing_metric_404(client):
    assert client.patch("/api/metrics/999", json={"steps": 100}).status_code == 404


def test_steps_round_trip(client):
    created = client.post("/api/metrics", json={"date": "2026-05-31", "steps": 8000}).json()
    assert created["steps"] == 8000
    assert created["weight_kg"] is None


def test_steps_only_is_allowed(client):
    assert client.post("/api/metrics", json={"date": "2026-05-31", "steps": 5000}).status_code == 200


def test_profile_round_trip_on_targets(client):
    payload = {
        "calorie_target": 2000,
        "protein_pct": 30,
        "carbs_pct": 40,
        "fat_pct": 30,
        "height_cm": 178,
        "birth_year": 1990,
        "sex": "male",
        "activity_factor": 1.375,
    }
    assert client.put("/api/targets", json=payload).status_code == 200, payload
    got = client.get("/api/targets").json()
    assert got["height_cm"] == 178
    assert got["birth_year"] == 1990
    assert got["sex"] == "male"
    assert got["activity_factor"] == 1.375


def test_goal_fields_round_trip_on_targets(client):
    payload = {
        "calorie_target": 2000,
        "protein_pct": 30,
        "carbs_pct": 40,
        "fat_pct": 30,
        "goal_weight_kg": 75,
        "goal_body_fat_pct": 15,
        "weekly_rate_kg": -0.5,
    }
    assert client.put("/api/targets", json=payload).status_code == 200
    got = client.get("/api/targets").json()
    assert got["goal_weight_kg"] == 75
    assert got["goal_body_fat_pct"] == 15
    assert got["weekly_rate_kg"] == -0.5
