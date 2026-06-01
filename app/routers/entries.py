"""CRUD for logged food entries + a per-day summary.

Every query is scoped to the signed-in user via ``user_query``; created rows get the
user's id, and id-addressed rows are ownership-checked before read/update/delete.
"""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.deps import get_current_user, get_owned, get_session, user_query
from app.models import FoodEntry, User
from app.schemas import DaySummary, EntryCreate, EntryRead, EntryUpdate

router = APIRouter(tags=["entries"])


def _day_bounds(day: date_cls) -> tuple[datetime, datetime]:
    """[start, end) datetimes spanning a calendar day, for range filtering logged_at."""
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return start, end


@router.post("/entries", response_model=EntryRead, status_code=201)
def create_entry(
    payload: EntryCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> FoodEntry:
    data = payload.model_dump()
    if data.get("logged_at") is None:
        data["logged_at"] = datetime.now(timezone.utc)
    entry = FoodEntry(**data, user_id=user.id)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/entries", response_model=list[EntryRead])
def list_entries(
    day: date_cls | None = Query(default=None, alias="date"),
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[FoodEntry]:
    stmt = user_query(FoodEntry, user)
    if day is not None:
        start, end = _day_bounds(day)
        stmt = stmt.where(FoodEntry.logged_at >= start, FoodEntry.logged_at <= end)
    stmt = stmt.order_by(FoodEntry.logged_at.desc()).offset(offset).limit(limit)
    return list(session.exec(stmt).all())


@router.get("/entries/summary", response_model=DaySummary)
def day_summary(
    day: date_cls = Query(alias="date"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> DaySummary:
    start, end = _day_bounds(day)
    stmt = user_query(FoodEntry, user).where(
        FoodEntry.logged_at >= start, FoodEntry.logged_at <= end
    )
    entries = list(session.exec(stmt).all())
    return DaySummary(
        date=day.isoformat(),
        entry_count=len(entries),
        total_calories=sum(e.calories for e in entries),
        total_protein_g=sum(e.protein_g for e in entries),
        total_carbs_g=sum(e.carbs_g for e in entries),
        total_fat_g=sum(e.fat_g for e in entries),
    )


@router.get("/entries/range", response_model=list[DaySummary])
def entries_range(
    start: date_cls = Query(alias="from"),
    end: date_cls = Query(alias="to"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[DaySummary]:
    """Per-day totals across [from, to] (inclusive). Sparse — only days with entries;
    the client fills gaps for the chart axis. Defined before /entries/{id} so the literal
    'range' segment isn't parsed as an id."""
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    stmt = user_query(FoodEntry, user).where(
        FoodEntry.logged_at >= start_dt, FoodEntry.logged_at <= end_dt
    )
    by_day: dict[date_cls, list[FoodEntry]] = {}
    for e in session.exec(stmt).all():
        by_day.setdefault(e.logged_at.date(), []).append(e)
    return [
        DaySummary(
            date=day.isoformat(),
            entry_count=len(group),
            total_calories=sum(x.calories for x in group),
            total_protein_g=sum(x.protein_g for x in group),
            total_carbs_g=sum(x.carbs_g for x in group),
            total_fat_g=sum(x.fat_g for x in group),
        )
        for day, group in sorted(by_day.items())
    ]


@router.get("/entries/{entry_id}", response_model=EntryRead)
def get_entry(
    entry_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> FoodEntry:
    return get_owned(session, FoodEntry, entry_id, user, what="Entry")


@router.patch("/entries/{entry_id}", response_model=EntryRead)
def update_entry(
    entry_id: int,
    payload: EntryUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> FoodEntry:
    entry = get_owned(session, FoodEntry, entry_id, user, what="Entry")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(entry, field, value)
    entry.updated_at = datetime.now(timezone.utc)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    entry = get_owned(session, FoodEntry, entry_id, user, what="Entry")
    session.delete(entry)
    session.commit()
