"""Database tables (SQLModel)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FoodEntry(SQLModel, table=True):
    """A single logged meal/food.

    ``user_id`` is the auth slot: always None in v1. When accounts land it becomes
    a FK to a users table, defaulted from ``get_current_user`` and used to scope queries.
    """

    __tablename__ = "food_entries"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    logged_at: datetime = Field(index=True)  # when the meal happened (client or server now)
    food_name: str

    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0

    serving_size: str | None = None
    confidence: float | None = None
    photo_ref: str | None = None  # filename under photos_dir, served at /photos/<ref>
    source: str = "ai"  # "ai" | "manual"
    items_json: str | None = None  # raw per-food breakdown from the model

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
