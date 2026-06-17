"""All-history data for the Trends page, scoped to the signed-in user."""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.deps import get_current_user, get_session, user_query
from app.models import BodyMetric, ExerciseEntry, FoodEntry, User
from app.schemas import DaySummary, ExerciseDaySummary, MetricRead, TrendHistory

router = APIRouter(tags=["trends"])


def _entry_summaries(entries: list[FoodEntry]) -> list[DaySummary]:
    by_day: dict[date_cls, list[FoodEntry]] = {}
    for entry in entries:
        by_day.setdefault(entry.logged_at.date(), []).append(entry)
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


def _exercise_summaries(entries: list[ExerciseEntry]) -> list[ExerciseDaySummary]:
    by_day: dict[date_cls, list[ExerciseEntry]] = {}
    for entry in entries:
        by_day.setdefault(entry.date, []).append(entry)
    return [
        ExerciseDaySummary(
            date=day.isoformat(),
            entry_count=len(group),
            total_calories=sum(x.calories for x in group),
        )
        for day, group in sorted(by_day.items())
    ]


@router.get("/trends/history", response_model=TrendHistory)
def trend_history(
    end: date_cls = Query(alias="to"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> TrendHistory:
    """Sparse all-history inputs for the Trends charts, bounded by the client's local day."""
    end_dt = datetime.combine(end, time.max)

    food_entries = list(
        session.exec(user_query(FoodEntry, user).where(FoodEntry.logged_at <= end_dt)).all()
    )
    exercise_entries = list(
        session.exec(user_query(ExerciseEntry, user).where(ExerciseEntry.date <= end)).all()
    )
    metrics = list(
        session.exec(
            user_query(BodyMetric, user)
            .where(BodyMetric.date <= end)
            .order_by(BodyMetric.date)
        ).all()
    )

    dates = [
        *(entry.logged_at.date() for entry in food_entries),
        *(entry.date for entry in exercise_entries),
        *(metric.date for metric in metrics),
    ]
    start = min(dates) if dates else end - timedelta(days=29)

    return TrendHistory(
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        entries=_entry_summaries(food_entries),
        exercise=_exercise_summaries(exercise_entries),
        metrics=[MetricRead.model_validate(metric, from_attributes=True) for metric in metrics],
    )
