"""GET /api/foods/recent — distinct recently-logged foods for fast re-logging.

Lets the client re-log a known food without another AI estimate. Scoped to the
signed-in user's own history via ``user_query``. Two orderings are supported:
``recent`` (newest distinct first) and ``frecency`` (frequency × recency decay), so
a daily staple stays near the top instead of falling off after a burst of one-off foods.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlmodel import Session, select

from app import barcode
from app.config import Settings
from app.deps import get_current_user, get_session, get_settings, user_query
from app.models import FoodEntry, User
from app.schemas import BarcodeFood, RecentFood

router = APIRouter(tags=["foods"])

# Candidate window: collapse the most-recent N rows by name. A food not logged within this
# window is genuinely stale and shouldn't surface; frequency (below) is still counted all-time.
_SCAN_LIMIT = 500

# Frecency = times_logged × 0.5 ** (days_since_last / half-life). A 14-day half-life halves a
# food's weight two weeks after its last log, so a long-idle staple eventually yields to fresher ones.
_FRECENCY_HALF_LIFE_DAYS = 14.0


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
        times_logged=times_logged,
    )


def _name_counts(session: Session, user: User, q: str | None) -> dict[str, int]:
    """All-time log count per normalized food name (case-insensitive), for frecency ranking.

    Counts the full history — not just the scan window — so a staple's true frequency is used.
    """
    key = func.lower(func.trim(FoodEntry.food_name))
    stmt = select(key, func.count()).where(FoodEntry.user_id == user.id).group_by(key)
    if q and q.strip():
        stmt = stmt.where(FoodEntry.food_name.ilike(f"%{q.strip()}%"))
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

    ``q`` filters by a substring of the food name. ``sort`` is ``recent`` (newest distinct
    first) or ``frecency`` (frequency × recency decay — staples surface even after a run of
    one-off foods). ``frecency`` results carry ``times_logged``.
    """
    stmt = user_query(FoodEntry, user).order_by(FoodEntry.logged_at.desc())
    if q and q.strip():
        stmt = stmt.where(FoodEntry.food_name.ilike(f"%{q.strip()}%"))
    rows = session.exec(stmt.limit(_SCAN_LIMIT)).all()

    # Collapse to the latest row per name (rows are newest-first, so the first occurrence wins).
    latest: dict[str, FoodEntry] = {}
    for e in rows:
        key = e.food_name.strip().lower()
        if key and key not in latest:
            latest[key] = e

    if sort == "frecency" and latest:
        counts = _name_counts(session, user, q)
        ref = max(e.logged_at for e in latest.values())  # newest activity = the decay anchor

        def score(item: tuple[str, FoodEntry]) -> float:
            key, e = item
            days = max(0.0, (ref - e.logged_at).total_seconds() / 86400.0)
            decay = 0.5 ** (days / _FRECENCY_HALF_LIFE_DAYS)
            return counts.get(key, 1) * decay

        ordered = sorted(latest.items(), key=score, reverse=True)
        return [_to_recent(e, counts.get(key, 1)) for key, e in ordered[:limit]]

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
