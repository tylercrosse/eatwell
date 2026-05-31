"""Daily nutrition targets: GET + PUT a single row.

Single user in v1: one row (lowest id), user_id stays NULL. When auth lands, scope by
user_id the same way the entries router will.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.deps import get_session
from app.models import Targets
from app.schemas import TargetsRead, TargetsUpdate

router = APIRouter(tags=["targets"])

# Returned (without persisting) until the user saves targets for the first time.
DEFAULTS = TargetsRead(calorie_target=2000.0, protein_pct=30.0, carbs_pct=40.0, fat_pct=30.0)


def _get_row(session: Session) -> Targets | None:
    return session.exec(select(Targets).order_by(Targets.id).limit(1)).first()


@router.get("/targets", response_model=TargetsRead)
def get_targets(session: Session = Depends(get_session)) -> Targets | TargetsRead:
    return _get_row(session) or DEFAULTS


@router.put("/targets", response_model=TargetsRead)
def put_targets(payload: TargetsUpdate, session: Session = Depends(get_session)) -> Targets:
    row = _get_row(session)
    if row is None:
        row = Targets()
        session.add(row)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
