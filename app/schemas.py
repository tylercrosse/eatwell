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

# --- AI estimation ---------------------------------------------------------


class FoodItem(BaseModel):
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


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
    serving_size_estimate: str
    confidence: float = Field(ge=0.0, le=1.0)


# JSON Schema passed to OpenRouter as response_format.json_schema.schema.
# strict mode requires additionalProperties:false and every key in "required".
FOOD_ANALYSIS_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "items": {
            "type": "array",
            "description": "Each distinct food detected in the photo",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string", "description": "Food name"},
                    "calories": {"type": "number", "description": "kcal"},
                    "protein_g": {"type": "number"},
                    "carbs_g": {"type": "number"},
                    "fat_g": {"type": "number"},
                },
                "required": ["name", "calories", "protein_g", "carbs_g", "fat_g"],
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
        "serving_size_estimate",
        "confidence",
    ],
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
    serving_size: str | None = None
    confidence: float | None = None
    photo_ref: str | None = None
    source: str = "manual"
    items_json: str | None = None
    meal: Meal | None = None
    logged_at: datetime | None = None  # defaults to server now if omitted


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
    serving_size: str | None = None


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


class TargetsUpdate(BaseModel):
    calorie_target: float = Field(ge=0)
    protein_pct: float = Field(ge=0, le=100)
    carbs_pct: float = Field(ge=0, le=100)
    fat_pct: float = Field(ge=0, le=100)
    goal_weight_kg: float | None = Field(default=None, ge=0)
    goal_body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    weekly_rate_kg: float | None = None  # target change/week; negative = loss

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
    note: str | None = None

    @model_validator(mode="after")
    def _at_least_one_measure(self) -> MetricCreate:
        if self.weight_kg is None and self.body_fat_pct is None:
            raise ValueError("Provide weight_kg and/or body_fat_pct.")
        return self


class MetricRead(BaseModel):
    id: int
    date: date_cls
    weight_kg: float | None
    body_fat_pct: float | None
    note: str | None
