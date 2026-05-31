"""CRUD for logged food entries + a per-day summary.

Single user in v1: no user_id filtering yet (the column stays NULL). When auth lands,
add Depends(get_current_user) and scope each query by user_id.
"""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.deps import get_session
from app.models import FoodEntry
from app.schemas import DaySummary, EntryCreate, EntryRead, EntryUpdate

router = APIRouter(tags=["entries"])


def _day_bounds(day: date_cls) -> tuple[datetime, datetime]:
    """[start, end) datetimes spanning a calendar day, for range filtering logged_at."""
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return start, end


@router.post("/entries", response_model=EntryRead, status_code=201)
def create_entry(payload: EntryCreate, session: Session = Depends(get_session)) -> FoodEntry:
    data = payload.model_dump()
    if data.get("logged_at") is None:
        data["logged_at"] = datetime.now(timezone.utc)
    entry = FoodEntry(**data)
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
) -> list[FoodEntry]:
    stmt = select(FoodEntry)
    if day is not None:
        start, end = _day_bounds(day)
        stmt = stmt.where(FoodEntry.logged_at >= start, FoodEntry.logged_at <= end)
    stmt = stmt.order_by(FoodEntry.logged_at.desc()).offset(offset).limit(limit)
    return list(session.exec(stmt).all())


@router.get("/entries/summary", response_model=DaySummary)
def day_summary(
    day: date_cls = Query(alias="date"),
    session: Session = Depends(get_session),
) -> DaySummary:
    start, end = _day_bounds(day)
    stmt = select(FoodEntry).where(FoodEntry.logged_at >= start, FoodEntry.logged_at <= end)
    entries = list(session.exec(stmt).all())
    return DaySummary(
        date=day.isoformat(),
        entry_count=len(entries),
        total_calories=sum(e.calories for e in entries),
        total_protein_g=sum(e.protein_g for e in entries),
        total_carbs_g=sum(e.carbs_g for e in entries),
        total_fat_g=sum(e.fat_g for e in entries),
    )


@router.get("/entries/{entry_id}", response_model=EntryRead)
def get_entry(entry_id: int, session: Session = Depends(get_session)) -> FoodEntry:
    entry = session.get(FoodEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found.")
    return entry


@router.patch("/entries/{entry_id}", response_model=EntryRead)
def update_entry(
    entry_id: int,
    payload: EntryUpdate,
    session: Session = Depends(get_session),
) -> FoodEntry:
    entry = session.get(FoodEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found.")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(entry, field, value)
    entry.updated_at = datetime.now(timezone.utc)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int, session: Session = Depends(get_session)) -> None:
    entry = session.get(FoodEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found.")
    session.delete(entry)
    session.commit()
