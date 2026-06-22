"""Food category taxonomy — the backend source of truth (mirrored in web/src/lib/foodCategory.ts).

This is a *visual-first* taxonomy: a category exists to share an **icon**, and the
icon depicts visual form — the vessel a food is served in (plate / bowl / mug /
glass) or a food's characteristic silhouette (pizza, banana, taco) — not its
nutritional category. We group by what a food *looks like on the table*, because
that is the only thing an icon can honestly represent.

Two tiers:
- ``GROUP_KEYS`` — ~20 coarse, stable Tier-1 groups. This is the enum the AI
  classifies into (small => reliable), and every group has a dedicated icon.
- ``TIER2_PARENTS`` — finer Tier-2 keys, each mapped to its parent group. Used to
  refine the icon when we have one; an icon-less Tier-2 falls back to its group's
  icon on the frontend.

Keep this in sync with ``web/src/lib/foodCategory.ts`` (manually mirrored, like the
snake_case API shapes). ``test_categories.py`` guards the invariants here.
"""

from __future__ import annotations

# Tier-1 groups, grouped by what they represent (order is documentation only).
GROUP_KEYS: tuple[str, ...] = (
    # Dish & distinctive-silhouette groups (vessel forms + unmistakable own-shape dishes).
    "handheld",
    "bowl",
    "plate",
    "pizza",
    "pasta",
    "salad",
    "soup_stew",
    "taco_burrito",
    "pastry",
    # Drinks, by vessel.
    "hot_drink",
    "cold_drink",
    "alcohol",
    # Whole foods & the rest.
    "fruit",
    "vegetables",
    "protein",
    "grains_bread",
    "dairy",
    "snacks",
    "sweets",
    "extras",
)

# Tier-2 key -> parent Tier-1 group. Richer where the log is densest (dishes/drinks).
TIER2_PARENTS: dict[str, str] = {
    # handheld
    "burger": "handheld",
    "sandwich": "handheld",
    "sub_hoagie": "handheld",
    "wrap": "handheld",
    "panini": "handheld",
    "hot_dog": "handheld",
    "bagel_sandwich": "handheld",
    "topped_toast": "handheld",
    # taco_burrito
    "taco": "taco_burrito",
    "burrito": "taco_burrito",
    "quesadilla": "taco_burrito",
    "nachos": "taco_burrito",
    "enchilada": "taco_burrito",
    # bowl
    "rice_bowl": "bowl",
    "grain_bowl": "bowl",
    "poke": "bowl",
    "fried_rice": "bowl",
    "curry_rice": "bowl",
    "risotto": "bowl",
    "ramen": "bowl",
    "pho": "bowl",
    "oatmeal": "bowl",
    "acai_smoothie_bowl": "bowl",
    "parfait": "bowl",
    "cereal_bowl": "bowl",
    "sushi": "bowl",
    "dumplings": "bowl",
    # plate
    "roast_plate": "plate",
    "bbq_skewer": "plate",
    "fried_chicken": "plate",
    "fried_seafood": "plate",
    "casserole_bake": "plate",
    "stir_fry": "plate",
    "mixed_plate": "plate",
    # pasta
    "red_sauce": "pasta",
    "cream_sauce": "pasta",
    "mac_cheese": "pasta",
    "lasagna": "pasta",
    "stir_fry_noodles": "pasta",
    # salad
    "green_salad": "salad",
    "grain_salad": "salad",
    "protein_salad": "salad",
    "slaw": "salad",
    # soup_stew
    "soup_broth": "soup_stew",
    "stew": "soup_stew",
    "chili": "soup_stew",
    "curry": "soup_stew",
    "chowder": "soup_stew",
    # pizza
    "flatbread": "pizza",
    "calzone": "pizza",
    # pastry
    "croissant": "pastry",
    "muffin": "pastry",
    "danish": "pastry",
    "scone": "pastry",
    "cinnamon_roll": "pastry",
    "turnover": "pastry",
    "bagel_plain": "pastry",
    # fruit
    "apple_pear": "fruit",
    "banana": "fruit",
    "berries": "fruit",
    "citrus": "fruit",
    "grapes": "fruit",
    "melon": "fruit",
    "tropical_fruit": "fruit",
    "dried_fruit": "fruit",
    # vegetables
    "leafy_greens": "vegetables",
    "root_veg": "vegetables",
    "potato": "vegetables",
    "tomato": "vegetables",
    "cruciferous": "vegetables",
    "mushroom": "vegetables",
    "avocado": "vegetables",
    "corn": "vegetables",
    # protein
    "poultry": "protein",
    "red_meat": "protein",
    "pork": "protein",
    "fish": "protein",
    "shellfish": "protein",
    "eggs_omelet": "protein",
    "tofu": "protein",
    "beans_legumes": "protein",
    # grains_bread
    "bread": "grains_bread",
    "rice": "grains_bread",
    "cereal": "grains_bread",
    "oats": "grains_bread",
    "tortilla": "grains_bread",
    "bagel_toast": "grains_bread",
    # dairy
    "cheese": "dairy",
    "milk": "dairy",
    "yogurt": "dairy",
    "butter_cream": "dairy",
    # snacks
    "chips": "snacks",
    "crackers": "snacks",
    "nuts_seeds": "snacks",
    "popcorn": "snacks",
    "pretzels": "snacks",
    "granola_bar": "snacks",
    "jerky": "snacks",
    # sweets
    "chocolate": "sweets",
    "candy": "sweets",
    "cake": "sweets",
    "cookie": "sweets",
    "donut": "sweets",
    "ice_cream": "sweets",
    "pie_tart": "sweets",
    "pancakes_waffles": "sweets",
    # hot_drink
    "coffee": "hot_drink",
    "tea": "hot_drink",
    "latte_cappuccino": "hot_drink",
    "hot_cocoa": "hot_drink",
    "matcha": "hot_drink",
    # cold_drink
    "water": "cold_drink",
    "juice": "cold_drink",
    "soda": "cold_drink",
    "smoothie": "cold_drink",
    "milk_drink": "cold_drink",
    "protein_shake": "cold_drink",
    "energy_drink": "cold_drink",
    "sports_drink": "cold_drink",
    "iced_coffee": "cold_drink",
    # alcohol
    "beer": "alcohol",
    "wine": "alcohol",
    "cocktail": "alcohol",
    "spirits": "alcohol",
    # extras
    "sauce_condiment": "extras",
    "dressing": "extras",
    "oil": "extras",
    "spread": "extras",
    "sweetener_syrup": "extras",
    "supplement": "extras",
    "protein_powder": "extras",
}

# Terminal fallbacks the resolver/renderer use when nothing confident matches. Not part
# of the AI enum; included so they validate if ever round-tripped through the API.
FALLBACK_KEYS: tuple[str, ...] = ("food_generic", "beverage_generic")

# Every key the API will accept on a stored entry (group, Tier-2, or fallback).
ALL_KEYS: frozenset[str] = frozenset(GROUP_KEYS) | set(TIER2_PARENTS) | set(FALLBACK_KEYS)


def normalize_category(value: str | None) -> str | None:
    """Coerce an arbitrary category string to a known key, or ``None``.

    Never raises: an unknown/garbage value becomes ``None`` so the client resolver
    falls back to keyword matching rather than the request being rejected.
    """
    if not value:
        return None
    key = value.strip().lower()
    return key if key in ALL_KEYS else None


# Open Food Facts ``categories_tags`` (e.g. "en:sodas") -> a taxonomy key. Matched by
# substring against each tag, most specific first; the first hit wins. Only a pragmatic
# subset of OFF's huge taxonomy — barcode foods that miss here fall through to the client
# keyword resolver on the product name.
_OFF_TAG_RULES: tuple[tuple[str, str], ...] = (
    ("energy-drink", "energy_drink"),
    ("sport-drink", "sports_drink"),
    ("soft-drink", "soda"),
    ("soda", "soda"),
    ("ice-cream", "ice_cream"),
    ("milk", "milk"),
    ("yogurt", "yogurt"),
    ("yoghurt", "yogurt"),
    ("cheese", "cheese"),
    ("coffee", "coffee"),
    ("tea", "tea"),
    ("water", "water"),
    ("juice", "juice"),
    ("smoothie", "smoothie"),
    ("beer", "beer"),
    ("wine", "wine"),
    ("spirit", "spirits"),
    ("chocolate", "chocolate"),
    ("biscuit", "cookie"),
    ("cookie", "cookie"),
    ("cake", "cake"),
    ("pastr", "croissant"),
    ("croissant", "croissant"),
    ("candie", "candy"),
    ("candy", "candy"),
    ("cereal", "cereal"),
    ("crisp", "chips"),
    ("chips", "chips"),
    ("pretzel", "pretzels"),
    ("popcorn", "popcorn"),
    ("granola", "granola_bar"),
    ("cereal-bar", "granola_bar"),
    ("jerky", "jerky"),
    ("nut", "nuts_seeds"),
    ("pizza", "pizza"),
    ("pasta", "pasta"),
    ("bread", "bread"),
    ("dried-fruit", "dried_fruit"),
    ("sauce", "sauce_condiment"),
    ("oil", "oil"),
    ("honey", "sweetener_syrup"),
    ("syrup", "sweetener_syrup"),
    ("supplement", "supplement"),
)


def off_tags_to_category(tags: list[str] | None) -> str | None:
    """Map an Open Food Facts ``categories_tags`` list to a taxonomy key, or ``None``."""
    for tag in tags or []:
        t = str(tag).lower()
        for substr, key in _OFF_TAG_RULES:
            if substr in t:
                return key
    return None
