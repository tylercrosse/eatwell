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
