"""USDA FoodData Central client.

Grounds the text-description estimate: given a food query, returns candidate matches
with macros normalized to per-100g, which the model then scales to the actual portion.
FDC's search endpoint reports ``foodNutrients`` per 100 g/ml across all data types.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import Settings

_TIMEOUT = 15.0

# FDC nutrientNumber codes (stable across data types).
_ENERGY_KCAL = "208"
_PROTEIN = "203"
_FAT = "204"
_CARBS = "205"


class UsdaError(RuntimeError):
    """A FoodData Central request failed."""


@dataclass
class FoodMatch:
    description: str
    data_type: str
    calories_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    branded_serving: str | None = None  # e.g. "240 ml"; only present for Branded items


def _nutrient_map(food: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for n in food.get("foodNutrients", []):
        number = n.get("nutrientNumber")
        value = n.get("value")
        if number is not None and isinstance(value, (int, float)):
            out[str(number)] = float(value)
    return out


def _energy_kcal(food: dict, nutrients: dict[str, float]) -> float:
    if _ENERGY_KCAL in nutrients:
        return nutrients[_ENERGY_KCAL]
    # Fall back to any KCAL energy nutrient (e.g. the Atwater-factor variants).
    for n in food.get("foodNutrients", []):
        name = (n.get("nutrientName") or "").lower()
        unit = (n.get("unitName") or "").upper()
        if "energy" in name and unit == "KCAL" and isinstance(n.get("value"), (int, float)):
            return float(n["value"])
    return 0.0


def _branded_serving(food: dict) -> str | None:
    size = food.get("servingSize")
    unit = food.get("servingSizeUnit")
    if isinstance(size, (int, float)) and unit:
        return f"{size:g} {unit}"
    return None


def _parse_food(food: dict) -> FoodMatch:
    nutrients = _nutrient_map(food)
    return FoodMatch(
        description=food.get("description", "Unknown"),
        data_type=food.get("dataType", "Unknown"),
        calories_per_100g=_energy_kcal(food, nutrients),
        protein_per_100g=nutrients.get(_PROTEIN, 0.0),
        carbs_per_100g=nutrients.get(_CARBS, 0.0),
        fat_per_100g=nutrients.get(_FAT, 0.0),
        branded_serving=_branded_serving(food),
    )


async def search_foods(query: str, settings: Settings) -> list[FoodMatch]:
    """Search FoodData Central, returning trimmed per-100g candidate matches."""
    if not settings.usda_api_key:
        raise UsdaError("USDA_API_KEY is not configured.")

    params = {
        "query": query,
        "pageSize": settings.usda_search_page_size,
        "api_key": settings.usda_api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{settings.usda_base_url}/foods/search", params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise UsdaError(f"FoodData Central request failed: {exc}") from exc

    return [_parse_food(f) for f in data.get("foods", [])]
