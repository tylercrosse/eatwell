"""Invariants for the food-category taxonomy (app/categories.py)."""

from __future__ import annotations

from app import categories
from app.schemas import FOOD_ANALYSIS_JSON_SCHEMA, BarcodeFood, EntryCreate, FoodItem


def test_every_tier2_has_a_real_parent_group():
    for key, parent in categories.TIER2_PARENTS.items():
        assert parent in categories.GROUP_KEYS, f"{key} -> unknown group {parent}"


def test_keys_do_not_collide_across_tiers():
    overlap = set(categories.GROUP_KEYS) & set(categories.TIER2_PARENTS)
    assert not overlap, f"keys are both a group and a Tier-2: {overlap}"
    fallback = set(categories.FALLBACK_KEYS)
    assert not (fallback & set(categories.GROUP_KEYS))
    assert not (fallback & set(categories.TIER2_PARENTS))


def test_normalize_category_coerces_unknown_to_none():
    assert categories.normalize_category("bowl") == "bowl"  # a group
    assert categories.normalize_category("croissant") == "croissant"  # a Tier-2 key
    assert categories.normalize_category("  POKE ") == "poke"  # trimmed + lowercased
    assert categories.normalize_category("not_a_category") is None
    assert categories.normalize_category(None) is None
    assert categories.normalize_category("") is None


def test_off_tags_map_to_known_keys():
    assert categories.off_tags_to_category(["en:sodas", "en:beverages"]) == "soda"
    assert categories.off_tags_to_category(["en:coffees"]) == "coffee"
    assert categories.off_tags_to_category(["en:ice-creams", "en:creams"]) == "ice_cream"
    assert categories.off_tags_to_category(["en:unmapped-thing"]) is None
    # Whatever a rule yields must itself be a valid key.
    for _substr, key in categories._OFF_TAG_RULES:
        assert key in categories.ALL_KEYS, f"OFF rule -> unknown key {key}"


def test_ai_schema_enum_matches_group_keys():
    item_props = FOOD_ANALYSIS_JSON_SCHEMA["properties"]["items"]["items"]
    assert item_props["properties"]["category"]["enum"] == list(categories.GROUP_KEYS)
    assert "category" in item_props["required"]


def test_schema_models_coerce_bad_category_to_none():
    assert FoodItem(name="x", calories=1, protein_g=0, carbs_g=0, fat_g=0, category="nope").category is None
    assert EntryCreate(food_name="x", category="garbage").category is None
    assert EntryCreate(food_name="x", category="pizza").category == "pizza"
    bf = BarcodeFood(barcode="1", name="x", source="usda", calories=1, protein_g=0,
                     carbs_g=0, fat_g=0, serving_size="1", category="SODA")
    assert bf.category == "soda"
