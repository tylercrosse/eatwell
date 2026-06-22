"""Barcode -> packaged-food nutrition lookup.

US-first: try USDA FoodData Central's *Branded* dataset by GTIN/UPC (the authoritative
US packaged-food source, reusing the configured USDA key), then fall back to Open Food
Facts (worldwide, no key) for international items and US gaps. Returns per-serving macros
ready to prefill a review draft, reusing the per-100g nutrient parsing in ``app.usda``.
"""

from __future__ import annotations

import httpx

from app import categories, usda
from app.config import Settings
from app.schemas import BarcodeFood

_TIMEOUT = 15.0

# How many Branded candidates to scan for an exact GTIN match (a code search usually ranks
# the right product first, but brand re-uses and re-packagings can return near-duplicates).
_USDA_PAGE_SIZE = 25

# FDC serving-size unit codes that we treat as grams / millilitres (~1 g·ml⁻¹ for our purposes).
_MASS_UNITS = {"g", "grm", "gram", "grams"}
_VOLUME_UNITS = {"ml", "mlt", "milliliter", "millilitre", "milliliters", "millilitres"}


class BarcodeError(RuntimeError):
    """A barcode lookup request failed (network / upstream error)."""


def _digits(code: str) -> str:
    return "".join(ch for ch in code if ch.isdigit())


def _gtin_match(a: str, b: str) -> bool:
    """Two GTIN/UPC strings refer to the same product, ignoring leading-zero padding.

    A UPC-A "049000028911" and its EAN-13/GTIN-14 forms ("0049000028911", …) all collapse
    to the same significant digits, so a 12-digit scan still matches a 13/14-digit record.
    """
    return _digits(a).lstrip("0") == _digits(b).lstrip("0")


def _nice(s: str) -> str:
    """Title-case an ALL-CAPS label (FDC branded names) but leave good casing alone."""
    s = s.strip()
    return s.title() if s and not any(c.islower() for c in s) else s


def _num(v: object) -> float | None:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _serving_grams(size: object, unit: str | None) -> float | None:
    """Serving size in grams (or ml treated as grams), or None if not a mass/volume."""
    n = _num(size)
    if n is None or n <= 0:
        return None
    u = (unit or "").strip().lower()
    return n if u in _MASS_UNITS or u in _VOLUME_UNITS else None


# --- USDA FoodData Central (Branded, by GTIN) ------------------------------


def _usda_food(barcode: str, food: dict) -> BarcodeFood:
    """Build a per-serving BarcodeFood from one FDC Branded search hit (per-100g nutrients)."""
    nutrients = usda._nutrient_map(food)
    grams = _serving_grams(food.get("servingSize"), food.get("servingSizeUnit"))
    factor = grams / 100.0 if grams else 1.0  # per-100g -> per-serving; else keep per-100g
    unit = (food.get("servingSizeUnit") or "").strip().lower()
    return BarcodeFood(
        barcode=barcode,
        name=_nice(food.get("description", "Unknown")),
        brand=_nice(food.get("brandOwner") or food.get("brandName") or "") or None,
        source="usda",
        calories=round(usda._energy_kcal(food, nutrients) * factor, 1),
        protein_g=round(nutrients.get(usda._PROTEIN, 0.0) * factor, 1),
        carbs_g=round(nutrients.get(usda._CARBS, 0.0) * factor, 1),
        fat_g=round(nutrients.get(usda._FAT, 0.0) * factor, 1),
        weight_g=round(grams, 1) if grams else None,
        fiber_g=round(nutrients.get(usda._FIBER, 0.0) * factor, 1),
        sugar_g=round(nutrients.get(usda._SUGARS, 0.0) * factor, 1),
        sodium_mg=round(nutrients.get(usda._SODIUM, 0.0) * factor, 1),  # FDC sodium is already mg
        is_beverage=unit in _VOLUME_UNITS,
        serving_size=_usda_serving_label(food, grams),
    )


def _usda_serving_label(food: dict, grams: float | None) -> str:
    household = (food.get("householdServingFullText") or "").strip()
    size, unit = food.get("servingSize"), (food.get("servingSizeUnit") or "").strip()
    portion = f"{size:g} {unit}".strip() if isinstance(size, (int, float)) and unit else ""
    if household and portion:
        return f"{household} ({portion})"
    return household or portion or ("100 g" if not grams else "1 serving")


async def _lookup_usda(barcode: str, settings: Settings) -> BarcodeFood | None:
    """Exact GTIN match in the FDC Branded dataset, or None if absent / no key configured."""
    if not settings.usda_api_key:
        return None
    params = {
        "query": barcode,
        "dataType": "Branded",
        "pageSize": _USDA_PAGE_SIZE,
        "api_key": settings.usda_api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{settings.usda_base_url}/foods/search", params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise BarcodeError(f"FoodData Central request failed: {exc}") from exc

    for food in data.get("foods", []):
        gtin = food.get("gtinUpc")
        if gtin and _gtin_match(str(gtin), barcode):
            return _usda_food(barcode, food)
    return None


# --- Open Food Facts (worldwide fallback) ----------------------------------


def _off_food(barcode: str, p: dict) -> BarcodeFood | None:
    """Build a per-serving BarcodeFood from an OFF product, or None if it has no energy data."""
    n = p.get("nutriments") or {}
    serving_q = _num(p.get("serving_quantity"))  # grams, when present
    has_serving = serving_q is not None and serving_q > 0
    basis = serving_q if has_serving else 100.0  # grams the returned values represent

    def val(serv_key: str, key_100: str) -> float | None:
        # Prefer OFF's own per-serving figure; else scale the per-100g figure to the serving.
        if has_serving:
            v = _num(n.get(serv_key))
            if v is not None:
                return v
        v100 = _num(n.get(key_100))
        return None if v100 is None else v100 * basis / 100.0

    kcal = val("energy-kcal_serving", "energy-kcal_100g")
    if kcal is None:
        return None  # no usable energy value -> not worth prefilling

    # OFF reports sodium/salt in grams; convert to mg (sodium ≈ salt / 2.5 when only salt is given).
    sodium_g = val("sodium_serving", "sodium_100g")
    if sodium_g is None:
        salt_g = val("salt_serving", "salt_100g")
        sodium_g = salt_g / 2.5 if salt_g is not None else 0.0

    name = (p.get("product_name") or p.get("product_name_en") or "").strip() or "Unknown product"
    brand = (p.get("brands") or "").split(",")[0].strip() or None
    cats = p.get("categories_tags") or []
    is_beverage = any("beverage" in c or "drink" in c for c in cats)
    label = (p.get("serving_size") or "").strip() or (f"{serving_q:g} g" if has_serving else "100 g")
    return BarcodeFood(
        barcode=barcode,
        name=name,
        brand=brand,
        source="openfoodfacts",
        calories=round(kcal, 1),
        protein_g=round(val("proteins_serving", "proteins_100g") or 0.0, 1),
        carbs_g=round(val("carbohydrates_serving", "carbohydrates_100g") or 0.0, 1),
        fat_g=round(val("fat_serving", "fat_100g") or 0.0, 1),
        weight_g=round(basis, 1),
        fiber_g=round(val("fiber_serving", "fiber_100g") or 0.0, 1),
        sugar_g=round(val("sugars_serving", "sugars_100g") or 0.0, 1),
        sodium_mg=round(sodium_g * 1000.0, 1),
        is_beverage=is_beverage,
        serving_size=label,
        category=categories.off_tags_to_category(cats),
    )


async def _lookup_off(barcode: str, settings: Settings) -> BarcodeFood | None:
    url = f"{settings.off_base_url}/api/v2/product/{barcode}.json"
    params = {
        "fields": "code,product_name,product_name_en,brands,serving_size,"
        "serving_quantity,nutriments,categories_tags",
    }
    headers = {"User-Agent": settings.off_user_agent}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise BarcodeError(f"Open Food Facts request failed: {exc}") from exc

    if data.get("status") != 1 or not data.get("product"):
        return None
    return _off_food(barcode, data["product"])


# --- Public entry point ----------------------------------------------------


async def lookup_barcode(barcode: str, settings: Settings) -> BarcodeFood | None:
    """Resolve a scanned barcode to a packaged food, or None if no source has it.

    Tries USDA Branded first (US-authoritative); falls through to Open Food Facts on a miss
    *or* a USDA outage, so a transient FDC error never blocks an OFF hit.
    """
    code = _digits(barcode)
    if not 8 <= len(code) <= 14:  # EAN-8 … GTIN-14 — anything else isn't a product code
        return None
    try:
        food = await _lookup_usda(code, settings)
        if food is not None:
            return food
    except BarcodeError:
        pass  # USDA hiccup -> still try the worldwide fallback
    return await _lookup_off(code, settings)
