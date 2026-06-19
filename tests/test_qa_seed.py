from __future__ import annotations

from datetime import date, datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.deps import get_current_user
from app.main import app
from app.models import BodyMetric, ExerciseEntry, FoodEntry, Targets, User
from app.qa_seed import QA_PERSONAS, preview_qa_seed, seed_qa_data

END_DATE = date(2026, 6, 19)


def _seeded_users(session: Session) -> dict[str, User]:
    users: dict[str, User] = {}
    for persona in QA_PERSONAS:
        user = session.exec(select(User).where(User.google_sub == persona.google_sub)).one()
        users[persona.account_id] = user
    return users


def _count(session: Session, model: type, user_id: int) -> int:
    return len(session.exec(select(model).where(model.user_id == user_id)).all())


def _counts_by_account(session: Session) -> dict[str, tuple[int, int, int, int]]:
    counts: dict[str, tuple[int, int, int, int]] = {}
    for account_id, user in _seeded_users(session).items():
        assert user.id is not None
        counts[account_id] = (
            _count(session, FoodEntry, user.id),
            _count(session, BodyMetric, user.id),
            _count(session, ExerciseEntry, user.id),
            _count(session, Targets, user.id),
        )
    return counts


def test_preview_counts_are_bounded_and_narrative():
    summaries = {s.account_id: s for s in preview_qa_seed(END_DATE)}

    loss = summaries["qa-loss"]
    assert (loss.end_date - loss.start_date).days == (365 * 5) - 1
    assert loss.food_entries >= 6500
    assert loss.metrics == 365 * 5
    assert 600 <= loss.exercise_entries <= 900

    gain = summaries["qa-gain"]
    assert 500 <= (gain.end_date - gain.start_date).days <= 560
    assert gain.food_entries >= 2000
    assert gain.metrics == 548
    assert 250 <= gain.exercise_entries <= 450

    sporadic = summaries["qa-sporadic"]
    assert sporadic.food_entries < 400
    assert 35 <= sporadic.metrics <= 110
    assert 10 <= sporadic.exercise_entries <= 35


def test_seed_creates_named_users_and_is_idempotent():
    with Session(engine) as session:
        summaries = seed_qa_data(session, END_DATE)
        first_counts = _counts_by_account(session)
        users = _seeded_users(session)

        assert {s.account_id for s in summaries} == {"qa-loss", "qa-gain", "qa-sporadic"}
        assert users["qa-loss"].email == "qa-loss@example.test"
        assert users["qa-gain"].name == "QA Gain"
        assert first_counts["qa-loss"][3] == 1
        assert first_counts["qa-gain"][3] == 1
        assert first_counts["qa-sporadic"][3] == 1

        loss_id = users["qa-loss"].id
        assert loss_id is not None
        session.add(
            FoodEntry(
                user_id=loss_id,
                logged_at=datetime(2026, 6, 19, 23, 0),
                food_name="Temporary duplicate",
                calories=999,
            )
        )
        session.commit()

        seed_qa_data(session, END_DATE)
        assert _counts_by_account(session) == first_counts
        assert _seeded_users(session)["qa-loss"].id == loss_id


def test_seed_preserves_non_seeded_user_data():
    with Session(engine) as session:
        other = User(google_sub="google:other", email="other@example.com", name="Other")
        session.add(other)
        session.commit()
        session.refresh(other)
        assert other.id is not None

        session.add(FoodEntry(user_id=other.id, logged_at=datetime(2026, 6, 19, 8, 0), food_name="Toast"))
        session.add(BodyMetric(user_id=other.id, date=END_DATE, weight_kg=70.0))
        session.add(ExerciseEntry(user_id=other.id, date=END_DATE, description="Walk", calories=100))
        session.add(Targets(user_id=other.id))
        session.commit()

        seed_qa_data(session, END_DATE)

        assert _count(session, FoodEntry, other.id) == 1
        assert _count(session, BodyMetric, other.id) == 1
        assert _count(session, ExerciseEntry, other.id) == 1
        assert _count(session, Targets, other.id) == 1


def test_seeded_loss_history_reads_through_trends_endpoint():
    with Session(engine) as session:
        summaries = {s.account_id: s for s in seed_qa_data(session, END_DATE)}
        loss_user = _seeded_users(session)["qa-loss"]

    app.dependency_overrides[get_current_user] = lambda: loss_user
    try:
        with TestClient(app) as client:
            response = client.get("/api/trends/history", params={"to": END_DATE.isoformat()})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["start_date"] == summaries["qa-loss"].start_date.isoformat()
    assert body["end_date"] == END_DATE.isoformat()
    assert len(body["entries"]) >= 1600
    assert len(body["metrics"]) == 365 * 5
    assert len(body["exercise"]) >= 600
