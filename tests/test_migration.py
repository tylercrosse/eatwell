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


def _columns(eng) -> set[str]:
    with eng.connect() as conn:
        return {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(food_entries)")}


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
