"""GET /api/foods/recent — distinct recently-logged foods for fast re-logging.

Lets the client re-log a known food without another AI estimate. Single user in v1:
no user_id filtering yet (the column stays NULL). When auth lands, add
Depends(get_current_user) and scope the query by user_id.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.deps import get_session
from app.models import FoodEntry
from app.schemas import RecentFood

router = APIRouter(tags=["foods"])

# Scan the most-recent N rows and collapse by name in Python — cheaper and simpler than
# a GROUP BY with a correlated max(logged_at) on SQLite, and the window is plenty deep.
_SCAN_LIMIT = 500


@router.get("/foods/recent", response_model=list[RecentFood])
def recent_foods(
    q: str | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    session: Session = Depends(get_session),
) -> list[RecentFood]:
    """Most-recent distinct foods (case-insensitive by name), newest first.

    ``q`` filters by a substring of the food name.
    """
    stmt = select(FoodEntry).order_by(FoodEntry.logged_at.desc())
    if q and q.strip():
        stmt = stmt.where(FoodEntry.food_name.ilike(f"%{q.strip()}%"))
    rows = session.exec(stmt.limit(_SCAN_LIMIT)).all()

    seen: set[str] = set()
    out: list[RecentFood] = []
    for e in rows:
        key = e.food_name.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(
            RecentFood(
                food_name=e.food_name,
                calories=e.calories,
                protein_g=e.protein_g,
                carbs_g=e.carbs_g,
                fat_g=e.fat_g,
                weight_g=e.weight_g,
                fiber_g=e.fiber_g,
                sugar_g=e.sugar_g,
                sodium_mg=e.sodium_mg,
                serving_size=e.serving_size,
            )
        )
        if len(out) >= limit:
            break
    return out
