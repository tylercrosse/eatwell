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


# Columns added to food_entries after its original shape, as {name: SQLite type}.
# create_all never ALTERs an existing table, so each is added below if missing.
_FOOD_ENTRY_ADDED_COLUMNS: dict[str, str] = {
    "meal": "VARCHAR",
    "weight_g": "FLOAT",
    "fiber_g": "FLOAT",
    "sugar_g": "FLOAT",
    "sodium_mg": "FLOAT",
}


def _migrate_add_columns(eng: Engine = engine) -> None:
    """Additive, idempotent column migrations for SQLite (no Alembic).

    Guarded by a PRAGMA membership check per column, so it's safe to run repeatedly.
    New nullable columns backfill existing rows to NULL.
    """
    with eng.connect() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(food_entries)")}
        for name, sql_type in _FOOD_ENTRY_ADDED_COLUMNS.items():
            if name not in cols:
                conn.exec_driver_sql(f"ALTER TABLE food_entries ADD COLUMN {name} {sql_type}")
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
