"""GET /api/foods/recent — distinct recently-logged foods for fast re-logging.

Lets the client re-log a known food without another AI estimate. Scoped to the
signed-in user's own history via ``user_query``. Two orderings are supported:
``recent`` (newest distinct first) and ``frecency`` (frequency × recency decay), so
a daily staple stays near the top instead of falling off after a burst of one-off foods.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlmodel import Session, select

from app import barcode
from app.categories import GROUP_KEYS, TIER2_PARENTS
from app.config import Settings
from app.deps import get_current_user, get_session, get_settings, user_query
from app.models import FoodEntry, User
from app.schemas import BarcodeFood, RecentFood

router = APIRouter(tags=["foods"])

# Candidate window: collapse the most-recent N rows by name. A food not logged within this
# window is genuinely stale and shouldn't surface; frequency (below) is still counted all-time.
_SCAN_LIMIT = 500
_SEARCH_SCAN_LIMIT = 5000

# Frecency = times_logged × 0.5 ** (days_since_last / half-life). A 14-day half-life halves a
# food's weight two weeks after its last log, so a long-idle staple eventually yields to fresher ones.
_FRECENCY_HALF_LIFE_DAYS = 14.0
_SEARCH_MIN_SCORE = 0.62
_PARENS_RE = re.compile(r"\([^)]*\)")
_PUNCT_RE = re.compile(r"[^a-z0-9]+")

_CATEGORY_SYNONYMS: dict[str, set[str]] = {
    "beverage": {"hot_drink", "cold_drink", "alcohol"},
    "bev": {"hot_drink", "cold_drink", "alcohol"},
    "drink": {"hot_drink", "cold_drink", "alcohol"},
    "drinks": {"hot_drink", "cold_drink", "alcohol"},
    "sandwich": {"handheld", "sandwich", "sub_hoagie", "panini"},
    "sub": {"handheld", "sub_hoagie"},
    "hoagie": {"handheld", "sub_hoagie"},
    "wrap": {"handheld", "wrap", "taco_burrito", "burrito"},
    "burrito": {"taco_burrito", "burrito", "wrap"},
    "taco": {"taco_burrito", "taco"},
    "bowl": {"bowl", "rice_bowl", "grain_bowl"},
    "oat": {"oatmeal", "oats"},
    "oats": {"oatmeal", "oats"},
    "yoghurt": {"yogurt", "parfait", "dairy"},
    "yogurt": {"yogurt", "parfait", "dairy"},
    "coffee": {"coffee", "latte_cappuccino", "iced_coffee"},
    "latte": {"latte_cappuccino", "iced_coffee"},
    "smoothy": {"smoothie", "acai_smoothie_bowl"},
    "smoothie": {"smoothie", "acai_smoothie_bowl"},
}

_NAME_SYNONYMS: dict[str, set[str]] = {
    "coffee": {"americano", "cafe", "cappuccino", "cortado", "espresso", "latte", "macchiato", "mocha"},
    "cafe": {"coffee", "cortado", "espresso", "latte"},
    "latte": {"cafe", "coffee", "cortado", "espresso"},
}


def _to_recent(e: FoodEntry, times_logged: int | None = None) -> RecentFood:
    return RecentFood(
        food_name=e.food_name,
        calories=e.calories,
        protein_g=e.protein_g,
        carbs_g=e.carbs_g,
        fat_g=e.fat_g,
        weight_g=e.weight_g,
        fiber_g=e.fiber_g,
        sugar_g=e.sugar_g,
        sodium_mg=e.sodium_mg,
        is_beverage=e.is_beverage,
        serving_size=e.serving_size,
        category=e.category,
        times_logged=times_logged,
    )


def _normalize_search_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = _PARENS_RE.sub(" ", value.lower())
    value = _PUNCT_RE.sub(" ", value)
    return " ".join(value.split())


def _search_tokens(value: str) -> list[str]:
    return [token for token in _normalize_search_text(value).split() if len(token) >= 2]


def _category_keys(category: str | None, is_beverage: bool) -> set[str]:
    keys: set[str] = set()
    if category:
        keys.add(category)
        parent = TIER2_PARENTS.get(category)
        if parent:
            keys.add(parent)
        elif category in GROUP_KEYS:
            keys.add(category)
    if is_beverage:
        keys.update({"hot_drink", "cold_drink", "alcohol"})
    return keys


def _category_search_score(query_tokens: list[str], category: str | None, is_beverage: bool) -> float:
    keys = _category_keys(category, is_beverage)
    if not keys:
        return 0.0
    key_tokens = {token for key in keys for token in key.split("_")}
    best = 0.0
    for token in query_tokens:
        synonyms = _CATEGORY_SYNONYMS.get(token, set())
        if token in key_tokens or synonyms.intersection(keys):
            best = max(best, 0.78)
        elif any(SequenceMatcher(None, token, key_token).ratio() >= 0.86 for key_token in key_tokens):
            best = max(best, 0.68)
    return best


def _token_match_score(query_tokens: list[str], name_tokens: list[str]) -> float:
    if not query_tokens or not name_tokens:
        return 0.0
    best_scores: list[float] = []
    for query in query_tokens:
        best = 0.0
        synonyms = _NAME_SYNONYMS.get(query, set())
        for name in name_tokens:
            if query == name:
                best = max(best, 1.0)
            elif name in synonyms:
                best = max(best, 0.93)
            elif name.startswith(query) or query.startswith(name):
                best = max(best, 0.9)
            else:
                best = max(best, SequenceMatcher(None, query, name).ratio())
        best_scores.append(best)
    score = sum(best_scores) / len(best_scores)
    if len(query_tokens) == 1 and name_tokens:
        query = query_tokens[0]
        synonyms = _NAME_SYNONYMS.get(query, set())
        if name_tokens[0] != query and name_tokens[0] not in synonyms:
            score *= max(0.72, min(1.0, 4 / len(name_tokens)))
    return score


def _search_score(query: str, entry: FoodEntry) -> float:
    query_norm = _normalize_search_text(query)
    if not query_norm:
        return 0.0
    name_norm = _normalize_search_text(entry.food_name)
    query_tokens = _search_tokens(query)
    name_tokens = _search_tokens(entry.food_name)

    exact_score = 1.0 if query_norm == name_norm else 0.0
    prefix_score = 0.97 if name_norm.startswith(query_norm) else 0.0
    substring_score = 0.0
    if query_norm and query_norm in name_norm:
        substring_score = 0.92
        if len(query_tokens) == 1 and name_tokens and name_tokens[0] != query_tokens[0]:
            substring_score *= max(0.72, min(1.0, 4 / len(name_tokens)))
    token_score = _token_match_score(query_tokens, name_tokens)
    sequence_score = SequenceMatcher(None, query_norm, name_norm).ratio()
    category_score = _category_search_score(query_tokens, entry.category, entry.is_beverage)
    return max(exact_score, prefix_score, substring_score, token_score, sequence_score, category_score)


def _name_counts(session: Session, user: User) -> dict[str, int]:
    """All-time log count per normalized food name (case-insensitive), for frecency ranking.

    Counts the full history — not just the scan window — so a staple's true frequency is used.
    """
    key = func.lower(func.trim(FoodEntry.food_name))
    stmt = select(key, func.count()).where(FoodEntry.user_id == user.id).group_by(key)
    return {name: count for name, count in session.exec(stmt).all()}


@router.get("/foods/recent", response_model=list[RecentFood])
def recent_foods(
    q: str | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    sort: str = Query(default="recent", pattern="^(recent|frecency)$"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[RecentFood]:
    """Distinct foods for one-tap re-logging.

    ``q`` fuzzily searches names and broad categories. ``sort`` is ``recent`` (newest
    distinct first) or ``frecency`` (frequency × recency decay — staples surface even
    after a run of one-off foods). ``frecency`` results carry ``times_logged``.
    """
    query = q.strip() if q else ""
    stmt = user_query(FoodEntry, user).order_by(FoodEntry.logged_at.desc())
    rows = session.exec(stmt.limit(_SEARCH_SCAN_LIMIT if query else _SCAN_LIMIT)).all()

    # Collapse to the latest row per name (rows are newest-first, so the first occurrence wins).
    latest: dict[str, FoodEntry] = {}
    for e in rows:
        key = e.food_name.strip().lower()
        if key and key not in latest:
            latest[key] = e

    scores = {key: _search_score(query, e) for key, e in latest.items()} if query else {}
    if query:
        latest = {key: e for key, e in latest.items() if scores.get(key, 0.0) >= _SEARCH_MIN_SCORE}

    if sort == "frecency" and latest:
        counts = _name_counts(session, user)
        ref = max(e.logged_at for e in latest.values())  # newest activity = the decay anchor

        def frecency(item: tuple[str, FoodEntry]) -> float:
            key, e = item
            days = max(0.0, (ref - e.logged_at).total_seconds() / 86400.0)
            decay = 0.5 ** (days / _FRECENCY_HALF_LIFE_DAYS)
            return counts.get(key, 1) * decay

        def sort_key(item: tuple[str, FoodEntry]) -> tuple[float, float]:
            return (scores.get(item[0], 0.0), frecency(item)) if query else (0.0, frecency(item))

        ordered = sorted(latest.items(), key=sort_key, reverse=True)
        return [_to_recent(e, counts.get(key, 1)) for key, e in ordered[:limit]]

    if query:
        ordered = sorted(latest.items(), key=lambda item: (scores.get(item[0], 0.0), item[1].logged_at), reverse=True)
        return [_to_recent(e) for _, e in ordered[:limit]]

    # recent: newest-first distinct (dict preserves insertion order).
    return [_to_recent(e) for e in list(latest.values())[:limit]]


@router.get("/foods/barcode/{code}", response_model=BarcodeFood)
async def barcode_lookup(
    code: str,
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
) -> BarcodeFood:
    """Resolve a scanned product barcode to packaged-food macros (US-first, then worldwide).

    Stateless — like ``/analyze``, the client reviews/edits the result and commits it via
    ``POST /api/entries``. 400 for an implausible code, 404 when no database has it, 502 if
    every upstream source errored.
    """
    digits = "".join(ch for ch in code if ch.isdigit())
    if not 8 <= len(digits) <= 14:
        raise HTTPException(status_code=400, detail="Not a valid product barcode.")
    try:
        food = await barcode.lookup_barcode(digits, settings)
    except barcode.BarcodeError as exc:
        # Both upstream sources are third parties we depend on -> surface as a bad gateway.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if food is None:
        raise HTTPException(status_code=404, detail="No product found for that barcode.")
    return food
