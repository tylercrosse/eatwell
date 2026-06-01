"""The standard test DB is created fresh (so it already has `meal` via create_all). To
exercise the ALTER branch we build a *legacy* food_entries table by hand and migrate it.
"""

from __future__ import annotations

from sqlmodel import create_engine

from app.db import _migrate_add_columns

LEGACY_CREATE = """
CREATE TABLE food_entries (
    id INTEGER PRIMARY KEY,
    logged_at DATETIME NOT NULL,
    food_name VARCHAR NOT NULL,
    calories FLOAT
)
"""


LEGACY_TARGETS_CREATE = """
CREATE TABLE targets (
    id INTEGER PRIMARY KEY,
    calorie_target FLOAT,
    protein_pct FLOAT,
    carbs_pct FLOAT,
    fat_pct FLOAT
)
"""


def _columns(eng, table: str = "food_entries") -> set[str]:
    with eng.connect() as conn:
        return {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}


def test_adds_meal_column_and_is_idempotent(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with eng.connect() as conn:
        conn.exec_driver_sql(LEGACY_CREATE)
        conn.exec_driver_sql(
            "INSERT INTO food_entries (logged_at, food_name, calories) "
            "VALUES ('2026-05-31T08:30:00', 'Eggs', 200)"
        )
        conn.commit()

    assert "meal" not in _columns(eng)

    _migrate_add_columns(eng)
    assert "meal" in _columns(eng)
    with eng.connect() as conn:
        rows = list(conn.exec_driver_sql("SELECT meal FROM food_entries"))
    assert rows == [(None,)]  # legacy row backfilled to NULL

    # Running again must not error or duplicate the column.
    _migrate_add_columns(eng)
    assert len([c for c in _columns(eng) if c == "meal"]) == 1


def test_adds_nutrition_columns_and_is_idempotent(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with eng.connect() as conn:
        conn.exec_driver_sql(LEGACY_CREATE)
        conn.commit()

    _migrate_add_columns(eng)
    cols = _columns(eng)
    for c in ("weight_g", "fiber_g", "sugar_g", "sodium_mg"):
        assert c in cols, f"{c} not added by migration"

    # Idempotent: a second run changes nothing and doesn't error.
    _migrate_add_columns(eng)
    assert _columns(eng) == cols


def test_adds_targets_goal_columns(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with eng.connect() as conn:
        conn.exec_driver_sql(LEGACY_TARGETS_CREATE)  # only targets exists (no food_entries)
        conn.commit()

    _migrate_add_columns(eng)  # must skip the absent food_entries table, not error
    cols = _columns(eng, "targets")
    for c in (
        "goal_weight_kg",
        "goal_body_fat_pct",
        "weekly_rate_kg",
        "height_cm",
        "birth_year",
        "sex",
        "activity_factor",
    ):
        assert c in cols, f"{c} not added by migration"


LEGACY_METRICS_CREATE = """
CREATE TABLE body_metrics (
    id INTEGER PRIMARY KEY,
    date DATE,
    weight_kg FLOAT,
    body_fat_pct FLOAT,
    note VARCHAR
)
"""


def test_adds_metric_steps_column(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with eng.connect() as conn:
        conn.exec_driver_sql(LEGACY_METRICS_CREATE)
        conn.commit()

    _migrate_add_columns(eng)
    assert "steps" in _columns(eng, "body_metrics")
