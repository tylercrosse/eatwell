"""Body metrics: log/read daily weight + body-fat %, scoped to the signed-in user.

One row per user per calendar day — POST upserts that day's row, so re-weighing just
updates it. The range GET feeds the trends charts.
"""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.deps import get_current_user, get_session, user_query
from app.models import BodyMetric, User
from app.schemas import MetricCreate, MetricRead

router = APIRouter(tags=["metrics"])


@router.post("/metrics", response_model=MetricRead)
def upsert_metric(
    payload: MetricCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> BodyMetric:
    day = payload.date or datetime.now().date()  # client sends its local day; fall back to server's
    row = session.exec(user_query(BodyMetric, user).where(BodyMetric.date == day)).first()
    if row is None:
        row = BodyMetric(user_id=user.id, date=day)
        session.add(row)
    # exclude_unset so a weight-only submission doesn't wipe an existing body_fat_pct.
    for field, value in payload.model_dump(exclude_unset=True, exclude={"date"}).items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.get("/metrics", response_model=list[MetricRead])
def list_metrics(
    start: date_cls | None = Query(default=None, alias="from"),
    end: date_cls | None = Query(default=None, alias="to"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[BodyMetric]:
    stmt = user_query(BodyMetric, user)
    if start is not None:
        stmt = stmt.where(BodyMetric.date >= start)
    if end is not None:
        stmt = stmt.where(BodyMetric.date <= end)
    return list(session.exec(stmt.order_by(BodyMetric.date)).all())


@router.delete("/metrics/{metric_id}", status_code=204)
def delete_metric(
    metric_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    row = session.get(BodyMetric, metric_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Metric not found.")
    session.delete(row)
    session.commit()
