"""Daily nutrition targets: GET + PUT the signed-in user's single row."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.deps import get_current_user, get_session, user_query
from app.models import Targets, User
from app.schemas import TargetsRead, TargetsUpdate

router = APIRouter(tags=["targets"])

# Returned (without persisting) until the user saves targets for the first time.
DEFAULTS = TargetsRead(calorie_target=2000.0, protein_pct=30.0, carbs_pct=40.0, fat_pct=30.0)


def _get_row(session: Session, user: User) -> Targets | None:
    return session.exec(user_query(Targets, user).order_by(Targets.id).limit(1)).first()


@router.get("/targets", response_model=TargetsRead)
def get_targets(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Targets | TargetsRead:
    return _get_row(session, user) or DEFAULTS


@router.put("/targets", response_model=TargetsRead)
def put_targets(
    payload: TargetsUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Targets:
    row = _get_row(session, user)
    if row is None:
        row = Targets(user_id=user.id)
        session.add(row)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
