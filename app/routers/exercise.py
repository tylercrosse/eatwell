"""CRUD for logged exercise/activity (calories burned), scoped to the signed-in user.

Mirrors the food-entry pattern but simpler (no macros): multiple workouts per day, each
with an estimated calorie burn (AI from free text, or entered manually).
"""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.deps import get_current_user, get_owned, get_session, user_query
from app.models import ExerciseEntry, User
from app.schemas import ExerciseCreate, ExerciseRead, ExerciseUpdate

router = APIRouter(tags=["exercise"])


@router.post("/exercise", response_model=ExerciseRead, status_code=201)
def create_exercise(
    payload: ExerciseCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ExerciseEntry:
    data = payload.model_dump()
    if data.get("date") is None:
        data["date"] = datetime.now().date()
    entry = ExerciseEntry(**data, user_id=user.id)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/exercise", response_model=list[ExerciseRead])
def list_exercise(
    day: date_cls = Query(alias="date"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[ExerciseEntry]:
    stmt = user_query(ExerciseEntry, user).where(ExerciseEntry.date == day).order_by(ExerciseEntry.id)
    return list(session.exec(stmt).all())


@router.patch("/exercise/{exercise_id}", response_model=ExerciseRead)
def update_exercise(
    exercise_id: int,
    payload: ExerciseUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ExerciseEntry:
    row = get_owned(session, ExerciseEntry, exercise_id, user, what="Exercise")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.delete("/exercise/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    row = get_owned(session, ExerciseEntry, exercise_id, user, what="Exercise")
    session.delete(row)
    session.commit()
