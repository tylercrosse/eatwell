"""Deterministic local QA sample data generation.

The seed data is intentionally synthetic but realistic enough to exercise the app's
daily log, trends, targets, recent foods, metrics, and exercise surfaces. It writes only
the named QA accounts below and can be rerun to replace their data without touching
other users.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import date as date_cls
from datetime import datetime, time, timedelta
from typing import Literal

from sqlmodel import Session, delete, select

from app.models import BodyMetric, ExerciseEntry, FoodEntry, Targets, User

MealName = Literal["breakfast", "lunch", "dinner", "snacks"]
PersonaKind = Literal["loss", "gain", "sporadic"]


QA_AUTH_ACCOUNTS = (
    "qa-loss|qa-loss@example.test|QA Loss,"
    "qa-gain|qa-gain@example.test|QA Gain,"
    "qa-sporadic|qa-sporadic@example.test|QA Sporadic"
)


@dataclass(frozen=True)
class Persona:
    account_id: str
    email: str
    name: str
    kind: PersonaKind
    days: int
    start_weight_kg: float
    end_weight_kg: float
    start_body_fat_pct: float
    end_body_fat_pct: float
    targets: dict[str, float | int | str | None]

    @property
    def google_sub(self) -> str:
        return f"qa:{self.account_id}"


@dataclass(frozen=True)
class SeedSummary:
    account_id: str
    email: str
    start_date: date_cls
    end_date: date_cls
    food_entries: int
    metrics: int
    exercise_entries: int
    targets: int = 1


@dataclass(frozen=True)
class FoodTemplate:
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    weight_g: float
    fiber_g: float
    sugar_g: float
    sodium_mg: float
    is_beverage: bool
    serving_size: str


@dataclass
class GeneratedSeed:
    target: Targets
    metrics: list[BodyMetric]
    exercises: list[ExerciseEntry]
    foods: list[FoodEntry]


QA_PERSONAS: tuple[Persona, ...] = (
    Persona(
        account_id="qa-loss",
        email="qa-loss@example.test",
        name="QA Loss",
        kind="loss",
        days=365 * 5,
        start_weight_kg=96.0,
        end_weight_kg=78.4,
        start_body_fat_pct=31.0,
        end_body_fat_pct=21.0,
        targets={
            "calorie_target": 2100.0,
            "protein_pct": 35.0,
            "carbs_pct": 35.0,
            "fat_pct": 30.0,
            "goal_weight_kg": 76.0,
            "goal_body_fat_pct": 18.0,
            "weekly_rate_kg": -0.35,
            "height_cm": 178.0,
            "birth_year": 1988,
            "sex": "male",
            "activity_factor": 1.45,
        },
    ),
    Persona(
        account_id="qa-gain",
        email="qa-gain@example.test",
        name="QA Gain",
        kind="gain",
        days=548,
        start_weight_kg=72.5,
        end_weight_kg=81.8,
        start_body_fat_pct=13.4,
        end_body_fat_pct=15.1,
        targets={
            "calorie_target": 3100.0,
            "protein_pct": 30.0,
            "carbs_pct": 45.0,
            "fat_pct": 25.0,
            "goal_weight_kg": 84.0,
            "goal_body_fat_pct": 15.0,
            "weekly_rate_kg": 0.2,
            "height_cm": 182.0,
            "birth_year": 1994,
            "sex": "male",
            "activity_factor": 1.65,
        },
    ),
    Persona(
        account_id="qa-sporadic",
        email="qa-sporadic@example.test",
        name="QA Sporadic",
        kind="sporadic",
        days=183,
        start_weight_kg=83.2,
        end_weight_kg=82.1,
        start_body_fat_pct=26.0,
        end_body_fat_pct=25.4,
        targets={
            "calorie_target": 1900.0,
            "protein_pct": 30.0,
            "carbs_pct": 40.0,
            "fat_pct": 30.0,
            "goal_weight_kg": 78.0,
            "goal_body_fat_pct": 22.0,
            "weekly_rate_kg": -0.15,
            "height_cm": 168.0,
            "birth_year": 1991,
            "sex": "female",
            "activity_factor": 1.3,
        },
    ),
)


LOSS_BREAKFAST = (
    FoodTemplate("Greek yogurt with berries", 330, 32, 38, 6, 320, 8, 20, 110, False, "1 bowl"),
    FoodTemplate("Egg white veggie scramble", 280, 31, 18, 9, 300, 5, 7, 520, False, "1 plate"),
    FoodTemplate("Protein oatmeal", 410, 34, 54, 8, 360, 9, 13, 180, False, "1 bowl"),
)
LOSS_LUNCH = (
    FoodTemplate("Chicken quinoa salad", 560, 48, 52, 18, 480, 11, 9, 780, False, "1 bowl"),
    FoodTemplate("Turkey avocado wrap", 520, 38, 48, 20, 320, 7, 6, 940, False, "1 wrap"),
    FoodTemplate("Tuna rice bowl", 610, 45, 68, 17, 500, 7, 8, 820, False, "1 bowl"),
)
LOSS_DINNER = (
    FoodTemplate("Salmon, rice, and broccoli", 680, 48, 58, 28, 560, 8, 5, 690, False, "1 plate"),
    FoodTemplate("Turkey chili", 590, 47, 55, 18, 520, 15, 11, 1050, False, "1 bowl"),
    FoodTemplate("Chicken fajita plate", 720, 54, 62, 25, 610, 10, 9, 1180, False, "1 plate"),
)
LOSS_SNACKS = (
    FoodTemplate("Apple with peanut butter", 260, 7, 31, 14, 210, 6, 22, 80, False, "1 snack"),
    FoodTemplate("Protein bar", 220, 20, 22, 7, 65, 6, 5, 190, False, "1 bar"),
    FoodTemplate("Cottage cheese cup", 180, 24, 12, 4, 220, 0, 8, 460, False, "1 cup"),
)
LOSS_EXTRAS = (
    FoodTemplate("Restaurant burger and fries", 1120, 42, 112, 54, 620, 8, 13, 1680, False, "1 meal"),
    FoodTemplate("Pizza slices", 860, 34, 92, 38, 360, 5, 8, 1500, False, "3 slices"),
    FoodTemplate("Ice cream", 360, 6, 42, 19, 160, 1, 34, 120, False, "1 cup"),
)

GAIN_BREAKFAST = (
    FoodTemplate("Eggs, toast, and potatoes", 760, 42, 82, 30, 560, 8, 8, 920, False, "1 plate"),
    FoodTemplate("Mass-gainer oatmeal", 830, 48, 112, 22, 620, 12, 28, 330, False, "1 bowl"),
    FoodTemplate("Bagel breakfast sandwich", 720, 39, 76, 28, 380, 5, 9, 1280, False, "1 sandwich"),
)
GAIN_LUNCH = (
    FoodTemplate("Chicken burrito bowl", 920, 62, 104, 28, 720, 14, 9, 1420, False, "1 bowl"),
    FoodTemplate("Steak rice plate", 980, 66, 98, 36, 680, 7, 8, 1180, False, "1 plate"),
    FoodTemplate("Pasta with turkey meat sauce", 910, 58, 112, 24, 700, 10, 14, 980, False, "1 bowl"),
)
GAIN_DINNER = (
    FoodTemplate("Chicken pasta bake", 1040, 74, 118, 30, 760, 8, 12, 1250, False, "1 plate"),
    FoodTemplate("Beef stir fry with rice", 980, 62, 106, 34, 720, 9, 13, 1320, False, "1 plate"),
    FoodTemplate("Salmon sweet potato plate", 920, 58, 82, 38, 690, 10, 12, 760, False, "1 plate"),
)
GAIN_SNACKS = (
    FoodTemplate("Whey protein shake", 220, 32, 12, 5, 360, 1, 6, 180, True, "1 shaker"),
    FoodTemplate("Greek yogurt granola bowl", 520, 38, 62, 14, 420, 7, 31, 170, False, "1 bowl"),
    FoodTemplate("Peanut butter banana smoothie", 560, 28, 66, 22, 500, 7, 38, 210, True, "1 smoothie"),
    FoodTemplate("Trail mix", 320, 10, 28, 20, 75, 4, 18, 80, False, "1 handful"),
)

SPORADIC_MEALS = (
    FoodTemplate("Coffee", 20, 1, 3, 1, 300, 0, 2, 35, True, "1 coffee"),
    FoodTemplate("Breakfast sandwich", 480, 24, 44, 24, 260, 3, 5, 920, False, "1 sandwich"),
    FoodTemplate("Caesar salad with chicken", 640, 43, 30, 38, 430, 5, 6, 1180, False, "1 salad"),
    FoodTemplate("Sushi lunch combo", 760, 38, 102, 20, 520, 5, 16, 1450, False, "1 combo"),
    FoodTemplate("Takeout pad thai", 980, 35, 128, 34, 620, 7, 22, 1640, False, "1 box"),
    FoodTemplate("Protein bar", 220, 20, 22, 7, 65, 6, 5, 190, False, "1 bar"),
    FoodTemplate("Wine", 250, 0, 8, 0, 300, 0, 3, 20, True, "2 glasses"),
)


def preview_qa_seed(end_date: date_cls) -> list[SeedSummary]:
    """Return deterministic row counts without writing to the database."""
    return [_summary(persona, _generate_persona(persona, 0, end_date), end_date) for persona in QA_PERSONAS]


def seed_qa_data(session: Session, end_date: date_cls) -> list[SeedSummary]:
    """Replace all generated QA rows and return a summary of inserted data."""
    users = _upsert_users(session)
    user_ids = [u.id for u in users.values() if u.id is not None]
    _delete_seeded_data(session, user_ids)

    summaries: list[SeedSummary] = []
    for persona in QA_PERSONAS:
        user = users[persona.account_id]
        if user.id is None:  # defensive; SQLModel refresh above should populate this.
            raise RuntimeError(f"Seed user {persona.account_id} has no id.")
        generated = _generate_persona(persona, user.id, end_date)
        session.add(generated.target)
        session.add_all(generated.metrics)
        session.add_all(generated.exercises)
        session.add_all(generated.foods)
        summaries.append(_summary(persona, generated, end_date))

    session.commit()
    return summaries


def _upsert_users(session: Session) -> dict[str, User]:
    users: dict[str, User] = {}
    for persona in QA_PERSONAS:
        user = session.exec(select(User).where(User.google_sub == persona.google_sub)).first()
        if user is None:
            user = User(google_sub=persona.google_sub, email=persona.email)
        user.email = persona.email
        user.name = persona.name
        user.picture = None
        session.add(user)
        users[persona.account_id] = user
    session.commit()
    for user in users.values():
        session.refresh(user)
    return users


def _delete_seeded_data(session: Session, user_ids: list[int]) -> None:
    if not user_ids:
        return
    for model in (FoodEntry, BodyMetric, ExerciseEntry, Targets):
        session.exec(delete(model).where(model.user_id.in_(user_ids)))  # type: ignore[attr-defined]
    session.commit()


def _generate_persona(persona: Persona, user_id: int, end_date: date_cls) -> GeneratedSeed:
    rng = random.Random(f"calorie-tracker:{persona.account_id}:v1")
    start = end_date - timedelta(days=persona.days - 1)
    metrics: list[BodyMetric] = []
    exercises: list[ExerciseEntry] = []
    foods: list[FoodEntry] = []

    for index in range(persona.days):
        day = start + timedelta(days=index)
        metrics.extend(_metrics_for_day(persona, user_id, day, index, rng))
        exercises.extend(_exercise_for_day(persona, user_id, day, index, rng))
        foods.extend(_food_for_day(persona, user_id, day, index, rng))

    return GeneratedSeed(
        target=Targets(user_id=user_id, **persona.targets),
        metrics=metrics,
        exercises=exercises,
        foods=foods,
    )


def _metrics_for_day(
    persona: Persona,
    user_id: int,
    day: date_cls,
    index: int,
    rng: random.Random,
) -> list[BodyMetric]:
    progress = index / max(persona.days - 1, 1)
    weight = _body_weight(persona, progress, index, rng)
    body_fat = _body_fat(persona, progress, index, rng)
    steps = _steps(persona, day, index, rng)

    if persona.kind != "sporadic":
        return [
            BodyMetric(
                user_id=user_id,
                date=day,
                weight_kg=round(weight, 1),
                body_fat_pct=round(body_fat, 1),
                steps=steps,
            )
        ]

    has_weigh_in = index % 10 == 0 or rng.random() < 0.08
    has_steps = rng.random() < 0.34
    if not has_weigh_in and not has_steps:
        return []
    return [
        BodyMetric(
            user_id=user_id,
            date=day,
            weight_kg=round(weight, 1) if has_weigh_in else None,
            body_fat_pct=round(body_fat, 1) if has_weigh_in and rng.random() < 0.45 else None,
            steps=steps if has_steps else None,
            note="travel week" if has_weigh_in and index % 61 == 0 else None,
        )
    ]


def _body_weight(persona: Persona, progress: float, index: int, rng: random.Random) -> float:
    base = persona.start_weight_kg + (persona.end_weight_kg - persona.start_weight_kg) * progress
    waves = 0.55 * math.sin(index / 18) + 0.35 * math.sin(index / 73)
    noise = rng.gauss(0, 0.12)
    if persona.kind == "loss":
        bumps = (
            _bump(progress, 0.23, 0.035, 1.6)
            + _bump(progress, 0.47, 0.055, 2.0)
            + _bump(progress, 0.78, 0.03, 1.1)
        )
        return base + waves + bumps + noise
    if persona.kind == "gain":
        deloads = _bump(progress, 0.36, 0.045, -1.0) + _bump(progress, 0.72, 0.04, -0.8)
        return base + 0.45 * waves + deloads + noise
    return base + 0.7 * waves + _bump(progress, 0.55, 0.06, 1.4) + noise


def _body_fat(persona: Persona, progress: float, index: int, rng: random.Random) -> float:
    base = (
        persona.start_body_fat_pct
        + (persona.end_body_fat_pct - persona.start_body_fat_pct) * progress
    )
    waves = 0.25 * math.sin(index / 37) + rng.gauss(0, 0.08)
    return max(6.0, base + waves)


def _steps(persona: Persona, day: date_cls, index: int, rng: random.Random) -> int:
    weekday_bonus = 1300 if day.weekday() < 5 else -500
    if persona.kind == "loss":
        base = 8200 + weekday_bonus + 900 * math.sin(index / 29)
    elif persona.kind == "gain":
        base = 7200 + weekday_bonus + 500 * math.sin(index / 21)
    else:
        base = 5200 + weekday_bonus + 1200 * math.sin(index / 16)
    return max(900, int(base + rng.gauss(0, 1300)))


def _exercise_for_day(
    persona: Persona,
    user_id: int,
    day: date_cls,
    index: int,
    rng: random.Random,
) -> list[ExerciseEntry]:
    weekday = day.weekday()
    if persona.kind == "loss":
        entries: list[ExerciseEntry] = []
        if weekday in {0, 2, 5} and rng.random() < 0.62:
            entries.append(_exercise(user_id, day, "Zone 2 run", 38, 360 + rng.randint(-45, 55)))
        if weekday in {1, 4} and rng.random() < 0.38:
            entries.append(_exercise(user_id, day, "Strength training", 45, 240 + rng.randint(-35, 45)))
        if weekday == 6 and rng.random() < 0.25:
            entries.append(_exercise(user_id, day, "Long walk", 70, 300 + rng.randint(-40, 50)))
        return entries

    if persona.kind == "gain":
        if weekday in {0, 1, 3, 5} and rng.random() < 0.86:
            split = {
                0: "Upper body strength",
                1: "Lower body strength",
                3: "Push workout",
                5: "Pull workout",
            }[weekday]
            return [_exercise(user_id, day, split, 62, 330 + rng.randint(-45, 55))]
        if weekday == 6 and rng.random() < 0.32:
            return [_exercise(user_id, day, "Easy bike ride", 45, 260 + rng.randint(-30, 40))]
        return []

    if rng.random() < 0.11:
        options = (
            ("Walk after work", 32, 150),
            ("Yoga class", 50, 180),
            ("Weekend hike", 90, 460),
            ("Quick gym session", 35, 220),
        )
        desc, duration, calories = rng.choice(options)
        return [_exercise(user_id, day, desc, duration, calories + rng.randint(-35, 45))]
    return []


def _exercise(
    user_id: int,
    day: date_cls,
    description: str,
    duration_min: float,
    calories: float,
) -> ExerciseEntry:
    return ExerciseEntry(
        user_id=user_id,
        date=day,
        description=description,
        duration_min=duration_min,
        calories=max(0, round(calories, 1)),
        source="manual",
    )


def _food_for_day(
    persona: Persona,
    user_id: int,
    day: date_cls,
    index: int,
    rng: random.Random,
) -> list[FoodEntry]:
    if persona.kind == "loss":
        return _loss_food_for_day(user_id, day, index, rng)
    if persona.kind == "gain":
        return _gain_food_for_day(user_id, day, index, rng)
    return _sporadic_food_for_day(user_id, day, index, rng)


def _loss_food_for_day(
    user_id: int,
    day: date_cls,
    index: int,
    rng: random.Random,
) -> list[FoodEntry]:
    progress = index / (365 * 5 - 1)
    log_probability = 0.94 - 0.18 * _bump(progress, 0.47, 0.055, 1.0)
    if rng.random() > log_probability:
        return []
    entries = [
        _food(user_id, day, "breakfast", 7, rng.choice(LOSS_BREAKFAST), rng.uniform(0.9, 1.08)),
        _food(user_id, day, "lunch", 12, rng.choice(LOSS_LUNCH), rng.uniform(0.88, 1.08)),
        _food(user_id, day, "dinner", 19, rng.choice(LOSS_DINNER), rng.uniform(0.9, 1.12)),
    ]
    if rng.random() < 0.72:
        entries.append(_food(user_id, day, "snacks", 15, rng.choice(LOSS_SNACKS), rng.uniform(0.8, 1.25)))
    if rng.random() < 0.76:
        coffee = FoodTemplate("Coffee with milk", 45, 2, 5, 2, 300, 0, 5, 45, True, "1 coffee")
        entries.append(_food(user_id, day, "breakfast", 8, coffee, rng.uniform(0.8, 1.2)))
    if day.weekday() >= 5 and rng.random() < 0.34:
        entries.append(_food(user_id, day, "dinner", 20, rng.choice(LOSS_EXTRAS), rng.uniform(0.85, 1.15)))
    return entries


def _gain_food_for_day(
    user_id: int,
    day: date_cls,
    index: int,
    rng: random.Random,
) -> list[FoodEntry]:
    progress = index / 547
    deload_penalty = 0.12 * (_bump(progress, 0.36, 0.045, 1.0) + _bump(progress, 0.72, 0.04, 1.0))
    if rng.random() > 0.96 - deload_penalty:
        return []
    entries = [
        _food(user_id, day, "breakfast", 7, rng.choice(GAIN_BREAKFAST), rng.uniform(0.92, 1.12)),
        _food(user_id, day, "lunch", 12, rng.choice(GAIN_LUNCH), rng.uniform(0.9, 1.15)),
        _food(user_id, day, "dinner", 19, rng.choice(GAIN_DINNER), rng.uniform(0.92, 1.18)),
        _food(user_id, day, "snacks", 16, rng.choice(GAIN_SNACKS), rng.uniform(0.9, 1.2)),
    ]
    if rng.random() < 0.55:
        entries.append(_food(user_id, day, "snacks", 21, rng.choice(GAIN_SNACKS), rng.uniform(0.75, 1.1)))
    return entries


def _sporadic_food_for_day(
    user_id: int,
    day: date_cls,
    index: int,
    rng: random.Random,
) -> list[FoodEntry]:
    recent_boost = 0.16 if index > 150 else 0.0
    if rng.random() > 0.34 + recent_boost:
        return []
    count = 1 + int(rng.random() < 0.62) + int(rng.random() < 0.25)
    meal_order: tuple[tuple[MealName, int], ...] = (
        ("breakfast", 8),
        ("lunch", 13),
        ("dinner", 20),
        ("snacks", 16),
    )
    entries: list[FoodEntry] = []
    for meal, hour in rng.sample(meal_order, count):
        entries.append(_food(user_id, day, meal, hour, rng.choice(SPORADIC_MEALS), rng.uniform(0.75, 1.25)))
    return entries


def _food(
    user_id: int,
    day: date_cls,
    meal: MealName,
    hour: int,
    template: FoodTemplate,
    factor: float,
) -> FoodEntry:
    minute = (hash((day.isoformat(), template.name, meal)) % 4) * 10
    return FoodEntry(
        user_id=user_id,
        logged_at=datetime.combine(day, time(hour=hour, minute=minute)),
        food_name=template.name,
        calories=round(template.calories * factor, 1),
        protein_g=round(template.protein_g * factor, 1),
        carbs_g=round(template.carbs_g * factor, 1),
        fat_g=round(template.fat_g * factor, 1),
        weight_g=round(template.weight_g * factor, 1),
        fiber_g=round(template.fiber_g * factor, 1),
        sugar_g=round(template.sugar_g * factor, 1),
        sodium_mg=round(template.sodium_mg * factor, 1),
        is_beverage=template.is_beverage,
        serving_size=_serving_size(template.serving_size, factor),
        confidence=None,
        photo_ref=None,
        source="manual",
        items_json=None,
        meal=meal,
    )


def _serving_size(base: str, factor: float) -> str:
    if 0.95 <= factor <= 1.05:
        return base
    return f"{factor:.1f}x {base}"


def _bump(progress: float, center: float, width: float, magnitude: float) -> float:
    return magnitude * math.exp(-((progress - center) / width) ** 2)


def _summary(persona: Persona, generated: GeneratedSeed, end_date: date_cls) -> SeedSummary:
    return SeedSummary(
        account_id=persona.account_id,
        email=persona.email,
        start_date=end_date - timedelta(days=persona.days - 1),
        end_date=end_date,
        food_entries=len(generated.foods),
        metrics=len(generated.metrics),
        exercise_entries=len(generated.exercises),
    )
