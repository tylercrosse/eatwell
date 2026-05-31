"""SQLite engine + session management."""

from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

# check_same_thread=False: FastAPI runs sync DB work across threadpool workers.
engine = create_engine(
    settings.db_url,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create the data dir + tables. Safe to call repeatedly (idempotent)."""
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    settings.photos_dir.mkdir(parents=True, exist_ok=True)
    # Import models so they are registered on SQLModel.metadata before create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
