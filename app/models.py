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

    # Extended nutrition (optional; AI-estimated totals for this entry, NULL on legacy
    # rows). weight_g is the total edible weight and powers the calorie-density indicator
    # (kcal per 100g); fiber/sugar/sodium enrich the macro breakdown.
    weight_g: float | None = None
    fiber_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None

    serving_size: str | None = None
    confidence: float | None = None
    photo_ref: str | None = None  # filename under photos_dir, served at /photos/<ref>
    source: str = "ai"  # "ai" | "manual"
    items_json: str | None = None  # raw per-food breakdown from the model

    # "breakfast"|"lunch"|"dinner"|"snacks"; None (legacy rows) is read as "snacks".
    # Nullable with no DB CHECK so the additive migration works; validation is in Pydantic.
    meal: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Targets(SQLModel, table=True):
    """Daily nutrition targets. Single row in v1 (mirrors FoodEntry's user_id-NULL pattern).

    Stores a calorie target plus a protein/carbs/fat percent-of-calories split; gram targets
    are derived client-side via Atwater factors (4/4/9), so they aren't persisted here.
    """

    __tablename__ = "targets"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    calorie_target: float = 2000.0
    protein_pct: float = 30.0  # % of calories from protein
    carbs_pct: float = 40.0
    fat_pct: float = 30.0

    updated_at: datetime = Field(default_factory=_utcnow)
