"""Pydantic request/response models + the OpenRouter JSON schema.

``FOOD_ANALYSIS_JSON_SCHEMA`` is the single source of truth for the model's structured
output; ``AnalysisResult`` mirrors it and validates whatever the model returns.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

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
    serving_size: str | None = None
    confidence: float | None = None
    photo_ref: str | None = None
    source: str = "manual"
    items_json: str | None = None
    logged_at: datetime | None = None  # defaults to server now if omitted


class EntryUpdate(BaseModel):
    food_name: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    serving_size: str | None = None
    logged_at: datetime | None = None


class EntryRead(BaseModel):
    id: int
    logged_at: datetime
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    serving_size: str | None
    confidence: float | None
    photo_ref: str | None
    source: str
    created_at: datetime
    updated_at: datetime


class DaySummary(BaseModel):
    date: str  # YYYY-MM-DD
    entry_count: int
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
