"""Database tables (SQLModel)."""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """An authenticated account, keyed to a Google identity.

    ``google_sub`` is Google's stable, unique subject id (preferred over email, which can
    change). Profile fields are refreshed on each login. ``FoodEntry.user_id`` /
    ``Targets.user_id`` reference ``id`` (no DB-level FK, matching the SQLite-additive style).
    """

    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    google_sub: str = Field(index=True, unique=True)
    email: str = Field(index=True)
    name: str | None = None
    picture: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)


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

    # True when the entry is primarily a drink (coffee, juice, soda, alcohol, milk, smoothie).
    # Liquid calories are far less satiating, so the fullness score is capped for beverages and
    # their weight is shown as drink volume, separate from solid-food weight.
    is_beverage: bool = Field(default=False)

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

    # Body goals (optional). weekly_rate_kg is the target weight change per week
    # (negative = loss); feeds the TDEE-based target recommendation.
    goal_weight_kg: float | None = None
    goal_body_fat_pct: float | None = None
    weekly_rate_kg: float | None = None

    # Profile for BMR/TDEE (Mifflin-St Jeor). sex is 'male'|'female' (biological, for BMR);
    # activity_factor multiplies BMR (1.2 sedentary … 1.9 athlete).
    height_cm: float | None = None
    birth_year: int | None = None
    sex: str | None = None
    activity_factor: float | None = None

    updated_at: datetime = Field(default_factory=_utcnow)


class BodyMetric(SQLModel, table=True):
    """A daily body measurement: weight and/or body-fat %. One row per user per day.

    Weight is stored canonically in kilograms; the client converts for display (kg/lb).
    """

    __tablename__ = "body_metrics"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    date: date_cls = Field(index=True)  # local calendar day the measurement is for
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    steps: int | None = None  # daily step count; converted to kcal using that day's weight
    note: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class ExerciseEntry(SQLModel, table=True):
    """A logged workout/activity that burns calories. Multiple per day (like food entries).

    Calories are an estimate (AI from a free-text description, or entered manually).
    """

    __tablename__ = "exercise_entries"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    date: date_cls = Field(index=True)  # local calendar day the activity is for
    description: str
    duration_min: float | None = None
    calories: float = 0.0
    source: str = "manual"  # "manual" | "ai"

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
