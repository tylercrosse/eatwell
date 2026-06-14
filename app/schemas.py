"""Pydantic request/response models + the OpenRouter JSON schema.

``FOOD_ANALYSIS_JSON_SCHEMA`` is the single source of truth for the model's structured
output; ``AnalysisResult`` mirrors it and validates whatever the model returns.
"""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Canonical meal buckets, in display order: breakfast, lunch, dinner, snacks.
Meal = Literal["breakfast", "lunch", "dinner", "snacks"]
MENU_SCAN_OPTION_LIMIT = 24

# --- AI estimation ---------------------------------------------------------


class FoodItem(BaseModel):
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    # Per-item extended nutrition so each item can become its own entry (M6). Optional here
    # (older payloads / unit tests may omit them) but required in the strict JSON schema below.
    weight_g: float | None = None
    fiber_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None
    is_beverage: bool = False


class AnalysisResult(BaseModel):
    items: list[FoodItem]
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    # Extended totals. Optional here (older payloads / unit tests may omit them) but
    # required in the strict JSON schema below, so the model always returns them.
    total_weight_g: float | None = None
    total_fiber_g: float | None = None
    total_sugar_g: float | None = None
    total_sodium_mg: float | None = None
    # True when this is primarily a drink (coffee, juice, soda, alcohol, milk, smoothie).
    is_beverage: bool = False
    serving_size_estimate: str
    confidence: float = Field(ge=0.0, le=1.0)


class MenuOption(BaseModel):
    """One orderable option extracted from a restaurant menu photo.

    This is deliberately not a FoodEntry: menu scans compare choices before eating and
    should not imply logging-level precision.
    """

    name: str
    description: str = ""
    section: str = ""
    price: str = ""
    source_text: str = ""
    calories: float = Field(ge=0.0)
    protein_g: float = Field(ge=0.0)
    carbs_g: float = Field(ge=0.0)
    fat_g: float = Field(ge=0.0)
    weight_g: float = Field(ge=0.0)
    fiber_g: float = Field(ge=0.0)
    sugar_g: float = Field(ge=0.0)
    sodium_mg: float = Field(ge=0.0)
    is_beverage: bool = False
    serving_size_estimate: str
    confidence: float = Field(ge=0.0, le=1.0)


class MenuAnalysisResult(BaseModel):
    restaurant_name: str = ""
    options: list[MenuOption] = Field(max_length=MENU_SCAN_OPTION_LIMIT)
    confidence: float = Field(ge=0.0, le=1.0)


# JSON Schema passed to OpenRouter as response_format.json_schema.schema.
# strict mode requires additionalProperties:false and every key in "required".
FOOD_ANALYSIS_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "items": {
            "type": "array",
            "description": (
                "One entry per distinct DISH or DRINK you would log separately. Keep a composite "
                "dish whole — a salad, sandwich, bowl or stir-fry is ONE item with its combined "
                "nutrition (do NOT split it into ingredients). Separate only independently-served "
                "things: each plate/side, and every drink. Example: a plate of fruit + a bowl of "
                "yogurt + a coffee + a juice → 4 items; a caprese or burrata salad → 1 item."
            ),
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "Food name"},
                    "calories": {"type": "number", "description": "kcal"},
                    "protein_g": {"type": "number"},
                    "carbs_g": {"type": "number"},
                    "fat_g": {"type": "number"},
                    "weight_g": {"type": "number", "description": "This item's edible weight in grams"},
                    "fiber_g": {"type": "number", "description": "grams"},
                    "sugar_g": {"type": "number", "description": "grams"},
                    "sodium_mg": {"type": "number", "description": "milligrams"},
                    "is_beverage": {
                        "type": "boolean",
                        "description": "true if this item is a drink you sip (see overall is_beverage)",
                    },
                },
                "required": [
                    "name",
                    "calories",
                    "protein_g",
                    "carbs_g",
                    "fat_g",
                    "weight_g",
                    "fiber_g",
                    "sugar_g",
                    "sodium_mg",
                    "is_beverage",
                ],
            },
        },
        "total_calories": {"type": "number"},
        "total_protein_g": {"type": "number"},
        "total_carbs_g": {"type": "number"},
        "total_fat_g": {"type": "number"},
        "total_weight_g": {"type": "number", "description": "Total edible weight in grams"},
        "total_fiber_g": {"type": "number", "description": "grams"},
        "total_sugar_g": {"type": "number", "description": "grams"},
        "total_sodium_mg": {"type": "number", "description": "milligrams"},
        "is_beverage": {
            "type": "boolean",
            "description": (
                "true if this is primarily a drink you sip — coffee, tea, juice, soda, "
                "alcohol, milk, smoothie, protein shake. false for solid foods AND for "
                "soups/broths eaten as a meal (those satiate like food)."
            ),
        },
        "serving_size_estimate": {
            "type": "string",
            "description": "e.g. '1 bowl (~300g)'",
        },
        "confidence": {"type": "number", "description": "0 to 1"},
    },
    "required": [
        "items",
        "total_calories",
        "total_protein_g",
        "total_carbs_g",
        "total_fat_g",
        "total_weight_g",
        "total_fiber_g",
        "total_sugar_g",
        "total_sodium_mg",
        "is_beverage",
        "serving_size_estimate",
        "confidence",
    ],
}


MENU_ANALYSIS_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "restaurant_name": {
            "type": "string",
            "description": "Restaurant or menu name if visible; otherwise an empty string.",
        },
        "options": {
            "type": "array",
            "description": "Up to 24 clearly visible, orderable menu items, in menu reading order when possible.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "Orderable menu item name"},
                    "description": {"type": "string", "description": "Visible description, or empty string"},
                    "section": {
                        "type": "string",
                        "description": (
                            "Nearest visible menu section or column heading that applies to this item, "
                            "e.g. Salads, Burgers, Drinks; empty only when no heading is visible."
                        ),
                    },
                    "price": {"type": "string", "description": "Visible price, or empty string"},
                    "source_text": {
                        "type": "string",
                        "description": "The exact visible menu text used for this option, or closest excerpt.",
                    },
                    "calories": {"type": "number", "description": "Estimated kcal for one typical restaurant serving"},
                    "protein_g": {"type": "number"},
                    "carbs_g": {"type": "number"},
                    "fat_g": {"type": "number"},
                    "weight_g": {"type": "number", "description": "Estimated edible serving weight in grams"},
                    "fiber_g": {"type": "number"},
                    "sugar_g": {"type": "number"},
                    "sodium_mg": {"type": "number"},
                    "is_beverage": {
                        "type": "boolean",
                        "description": "true only for drink options; false for soups and solid foods.",
                    },
                    "serving_size_estimate": {
                        "type": "string",
                        "description": "Human serving estimate, e.g. '1 entree (~450g)'",
                    },
                    "confidence": {"type": "number", "description": "0 to 1"},
                },
                "required": [
                    "name",
                    "description",
                    "section",
                    "price",
                    "source_text",
                    "calories",
                    "protein_g",
                    "carbs_g",
                    "fat_g",
                    "weight_g",
                    "fiber_g",
                    "sugar_g",
                    "sodium_mg",
                    "is_beverage",
                    "serving_size_estimate",
                    "confidence",
                ],
            },
        },
        "confidence": {"type": "number", "description": "Overall confidence in menu extraction and estimates"},
    },
    "required": ["restaurant_name", "options", "confidence"],
}


# --- Entry CRUD ------------------------------------------------------------


class EntryCreate(BaseModel):
    food_name: str
    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    weight_g: float | None = None
    fiber_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None
    is_beverage: bool = False
    serving_size: str | None = None
    confidence: float | None = None
    photo_ref: str | None = None
    source: str = "manual"
    items_json: str | None = None
    meal: Meal | None = None
    logged_at: datetime | None = None  # defaults to server now if omitted


class EntriesBatchCreate(BaseModel):
    """Create several entries at once — one capture split into per-item entries (M6)."""

    entries: list[EntryCreate]


class EntryUpdate(BaseModel):
    food_name: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    weight_g: float | None = None
    fiber_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None
    is_beverage: bool | None = None
    serving_size: str | None = None
    meal: Meal | None = None
    logged_at: datetime | None = None


class EntryRead(BaseModel):
    id: int
    logged_at: datetime
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    weight_g: float | None
    fiber_g: float | None
    sugar_g: float | None
    sodium_mg: float | None
    is_beverage: bool = False  # default covers legacy rows that predate the column
    serving_size: str | None
    confidence: float | None
    photo_ref: str | None
    source: str
    meal: str | None  # str (not Meal) so an odd stored value never fails response validation
    created_at: datetime
    updated_at: datetime


class RecentFood(BaseModel):
    """A recently-logged food, returned for one-tap re-logging (no AI call)."""

    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    weight_g: float | None = None
    fiber_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None
    is_beverage: bool = False
    serving_size: str | None = None
    times_logged: int | None = None  # all-time log count for this name (frecency sort only)


class BarcodeFood(BaseModel):
    """A packaged food resolved from a scanned barcode, ready to prefill a review draft.

    Macros are for ONE serving (the package's serving size); the review card defaults
    ``servings`` to 1. Resolved US-first via USDA's Branded dataset, then Open Food Facts.
    """

    barcode: str
    name: str
    brand: str | None = None
    source: str  # "usda" | "openfoodfacts" — which database answered
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    weight_g: float | None = None  # serving weight in grams (powers the fullness badge)
    fiber_g: float = 0.0
    sugar_g: float = 0.0
    sodium_mg: float = 0.0
    is_beverage: bool = False
    serving_size: str  # human label, e.g. "1 bar (30 g)"


class DaySummary(BaseModel):
    date: str  # YYYY-MM-DD
    entry_count: int
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float


# --- Targets ---------------------------------------------------------------


class TargetsRead(BaseModel):
    calorie_target: float
    protein_pct: float
    carbs_pct: float
    fat_pct: float
    goal_weight_kg: float | None = None
    goal_body_fat_pct: float | None = None
    weekly_rate_kg: float | None = None
    height_cm: float | None = None
    birth_year: int | None = None
    sex: str | None = None
    activity_factor: float | None = None


class TargetsUpdate(BaseModel):
    calorie_target: float = Field(ge=0)
    protein_pct: float = Field(ge=0, le=100)
    carbs_pct: float = Field(ge=0, le=100)
    fat_pct: float = Field(ge=0, le=100)
    goal_weight_kg: float | None = Field(default=None, ge=0)
    goal_body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    weekly_rate_kg: float | None = None  # target change/week; negative = loss
    height_cm: float | None = Field(default=None, ge=0)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    sex: Literal["male", "female"] | None = None
    activity_factor: float | None = Field(default=None, ge=1.0, le=2.5)

    @model_validator(mode="after")
    def _split_sums_to_100(self) -> TargetsUpdate:
        total = self.protein_pct + self.carbs_pct + self.fat_pct
        if not (99.0 <= total <= 101.0):  # allow a little rounding slack
            raise ValueError("protein_pct + carbs_pct + fat_pct must sum to 100")
        return self


# --- Body metrics ----------------------------------------------------------


class MetricCreate(BaseModel):
    # Annotated with the aliased import (not bare ``date``): the field is named ``date`` and
    # its ``= None`` default would otherwise shadow the type during annotation evaluation.
    date: date_cls | None = None  # defaults to server's today if omitted
    weight_kg: float | None = Field(default=None, ge=0)
    body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    steps: int | None = Field(default=None, ge=0)
    note: str | None = None

    @model_validator(mode="after")
    def _at_least_one_measure(self) -> MetricCreate:
        if self.weight_kg is None and self.body_fat_pct is None and self.steps is None:
            raise ValueError("Provide weight_kg, body_fat_pct and/or steps.")
        return self


class MetricUpdate(BaseModel):
    # Partial update — only provided fields change; an explicit null clears that field
    # (so steps can be removed without dropping a same-day weight). No "at least one" rule.
    weight_kg: float | None = Field(default=None, ge=0)
    body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    steps: int | None = Field(default=None, ge=0)
    note: str | None = None


class MetricRead(BaseModel):
    id: int
    date: date_cls
    weight_kg: float | None
    body_fat_pct: float | None
    steps: int | None
    note: str | None


# --- Exercise --------------------------------------------------------------


class ExerciseCreate(BaseModel):
    description: str
    calories: float = Field(default=0.0, ge=0)
    duration_min: float | None = Field(default=None, ge=0)
    source: str = "manual"
    date: date_cls | None = None  # defaults to server's today if omitted


class ExerciseUpdate(BaseModel):
    description: str | None = None
    calories: float | None = Field(default=None, ge=0)
    duration_min: float | None = Field(default=None, ge=0)
    date: date_cls | None = None


class ExerciseRead(BaseModel):
    id: int
    date: date_cls
    description: str
    calories: float
    duration_min: float | None
    source: str


class ExerciseDaySummary(BaseModel):
    date: str  # YYYY-MM-DD
    entry_count: int
    total_calories: float


# --- Activity AI estimate --------------------------------------------------


class ActivityAnalyzeRequest(BaseModel):
    description: str


class ActivityResult(BaseModel):
    name: str
    duration_min: float | None = None
    calories: float
    confidence: float = Field(ge=0.0, le=1.0)


# Strict JSON schema for the activity estimator (mirrors the food one's shape).
ACTIVITY_ANALYSIS_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string", "description": "Short activity name, e.g. 'Light jog'"},
        "duration_min": {"type": "number", "description": "Estimated duration in minutes"},
        "calories": {"type": "number", "description": "Total kcal burned"},
        "confidence": {"type": "number", "description": "0 to 1"},
    },
    "required": ["name", "duration_min", "calories", "confidence"],
}
