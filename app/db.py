"""SQLite engine + session management."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

# check_same_thread=False: FastAPI runs sync DB work across threadpool workers.
engine = create_engine(
    settings.db_url,
    connect_args={"check_same_thread": False},
)


# Columns added to existing tables after their original shape, as {table: {name: type}}.
# create_all never ALTERs an existing table, so each is added below if missing. (Brand-new
# tables like body_metrics are created in full by create_all and don't appear here.)
_ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "food_entries": {
        "meal": "VARCHAR",
        "weight_g": "FLOAT",
        "fiber_g": "FLOAT",
        "sugar_g": "FLOAT",
        "sodium_mg": "FLOAT",
    },
    "targets": {
        "goal_weight_kg": "FLOAT",
        "goal_body_fat_pct": "FLOAT",
        "weekly_rate_kg": "FLOAT",
        "height_cm": "FLOAT",
        "birth_year": "INTEGER",
        "sex": "VARCHAR",
        "activity_factor": "FLOAT",
    },
    "body_metrics": {
        "steps": "INTEGER",
    },
}


def _migrate_add_columns(eng: Engine = engine) -> None:
    """Additive, idempotent column migrations for SQLite (no Alembic).

    Guarded by a PRAGMA membership check per column, so it's safe to run repeatedly.
    New nullable columns backfill existing rows to NULL. Tables absent from the DB (empty
    PRAGMA) are skipped, so this stays safe to call against a partial schema (e.g. tests).
    """
    with eng.connect() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if not existing:
                continue  # table doesn't exist yet; create_all will build it in full
            for name, sql_type in columns.items():
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}")
        conn.commit()


def init_db() -> None:
    """Create the data dir + tables, then apply additive migrations. Idempotent."""
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    settings.photos_dir.mkdir(parents=True, exist_ok=True)
    # Import models so they are registered on SQLModel.metadata before create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _migrate_add_columns()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
