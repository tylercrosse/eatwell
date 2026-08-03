"""Database tables (SQLModel)."""

from __future__ import annotations

from datetime import date as date_cls
from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """An authenticated account. Identities live in ``auth_identities``, not here.

    ``google_sub`` is a *legacy* column, no longer the identity key: it predates
    multi-provider sign-in, when a user could only be a Google account. It's still written
    (``app.accounts.legacy_sub`` puts ``provider:subject`` there for non-Google providers,
    matching the ``qa:<id>`` form ``app/qa_seed.py`` already relies on) because SQLite cannot
    drop a NOT NULL column via ALTER, and the additive migration style in ``app/db.py`` has no
    room for a table rebuild. Its unique index doubles as a duplicate-identity guard meanwhile.
    Removing it is a one-shot ``DROP INDEX ix_users_google_sub`` + ``ALTER TABLE users DROP
    COLUMN google_sub`` once ``auth_identities`` has been the read path for a release.

    ``FoodEntry.user_id`` / ``Targets.user_id`` reference ``id`` (no DB-level FK, matching the
    SQLite-additive style).
    """

    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    google_sub: str = Field(index=True, unique=True)
    email: str = Field(index=True)
    name: str | None = None
    picture: str | None = None

    # Access revoked: get_current_user 401s on this, so revoking an invite takes effect on the
    # next request instead of whenever the 30-day session JWT happens to expire.
    disabled_at: datetime | None = None

    created_at: datetime = Field(default_factory=_utcnow)


class AuthIdentity(SQLModel, table=True):
    """One external identity (provider + subject) linked to a :class:`User`.

    The real identity key. A single account can own several rows here — Google today, an
    email magic link tomorrow, Apple later — so a user who signs in a different way lands on
    the same data rather than a duplicate account.
    """

    __tablename__ = "auth_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_subject", name="uq_auth_identity_provider_subject"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)  # -> users.id (no DB-level FK, matching the house style)

    provider: str = Field(index=True)  # "google" | "email" | "qa" (later "apple")
    provider_subject: str  # Google's sub, a lowercased email, or a QA account id
    email: str | None = None  # as asserted by the provider when this identity was linked

    created_at: datetime = Field(default_factory=_utcnow)
    last_login_at: datetime | None = None


class Invite(SQLModel, table=True):
    """An email permitted to sign in — the guest list, replacing the ALLOWED_EMAILS env var.

    A row must exist and be un-revoked before any provider will admit an email, unless
    ``allow_open_signup`` is on. ALLOWED_EMAILS is folded in at startup as a seed so existing
    deploys keep working, but the table is the source of truth: adding someone no longer means
    a redeploy, and revoking takes effect immediately (see ``User.disabled_at``).
    """

    __tablename__ = "invites"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)  # always stored lowercased
    invited_by: str | None = None  # "seed" | "qa" | the inviting admin's email
    note: str | None = None  # free text, e.g. "Chad from the gym"

    created_at: datetime = Field(default_factory=_utcnow)
    accepted_at: datetime | None = None  # stamped on first successful sign-in
    revoked_at: datetime | None = None  # non-null -> denied


class LoginToken(SQLModel, table=True):
    """A pending email sign-in: one magic link plus the typed code that backs it up.

    Only hashes are stored, so a database leak doesn't hand over live sign-in credentials.

    A row is written for **every** request, including ones we decline to send (``sent`` stays
    False) — otherwise someone spraying uninvited addresses would be invisible to the per-IP
    rate limit, which counts rows in this table. Rows are pruned after a day, which also keeps
    ``request_ip`` from accumulating.
    """

    __tablename__ = "login_tokens"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True)  # lowercased; not necessarily a known user yet

    token_hash: str = Field(index=True, unique=True)  # sha256 of the link token
    code_hash: str | None = None  # sha256 of the 6-digit typed code
    attempts: int = Field(default=0)  # wrong code guesses, capped

    request_ip: str | None = Field(default=None, index=True)
    sent: bool = Field(default=False)  # False when the address wasn't invited

    # Set when this sign-in was authorised by an invite link rather than an existing invite.
    # Carried here so the link is spent at *verify*, not at request — otherwise a mistyped
    # address would burn a single-use invite before anyone actually got in.
    invite_link_id: int | None = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=_utcnow, index=True)
    expires_at: datetime
    consumed_at: datetime | None = None


class InviteLink(SQLModel, table=True):
    """A shareable bearer token that lets whoever holds it join.

    The point is handing someone access in person, from a phone, with no laptop and no typing
    their address into your device: mint one, share it, they open it and sign in with whichever
    provider they like. Only the hash is stored, so the raw token exists solely in the single
    response that mints it — it can't be looked up again afterwards.

    Distinct from :class:`Invite`, which names a specific address that may sign in. This says
    "the bearer may create an invite for themselves", which is a different lifecycle: it
    expires, it can be spent a limited number of times, and it isn't tied to an email yet.
    """

    __tablename__ = "invite_links"

    id: int | None = Field(default=None, primary_key=True)
    token_hash: str = Field(index=True, unique=True)

    created_by_user_id: int = Field(index=True)  # -> users.id (no DB FK, house style)
    note: str | None = None  # free text, e.g. "Sam at lunch"

    max_uses: int = Field(default=1)
    uses: int = Field(default=0)

    created_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime
    revoked_at: datetime | None = None


class FoodEntry(SQLModel, table=True):
    """A single logged meal/food.

    ``user_id`` is the auth slot: always None in v1. When accounts land it becomes
    a FK to a users table, defaulted from ``get_current_user`` and used to scope queries.
    """

    __tablename__ = "food_entries"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    logged_at: datetime = Field(index=True)  # when the meal happened (client or server now)
    food_name: str

    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0

    # Extended nutrition (optional; AI-estimated totals for this entry, NULL on legacy
    # rows). weight_g is the total edible weight and powers the calorie-density indicator
    # (kcal per 100g); fiber/sugar/sodium enrich the macro breakdown.
    weight_g: float | None = None
    fiber_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None

    # True when the entry is primarily a drink (coffee, juice, soda, alcohol, milk, smoothie).
    # Liquid calories are far less satiating, so the fullness score is capped for beverages and
    # their weight is shown as drink volume, separate from solid-food weight.
    is_beverage: bool = Field(default=False)

    serving_size: str | None = None
    confidence: float | None = None
    photo_ref: str | None = None  # filename under photos_dir, served at /photos/<ref>
    source: str = "ai"  # "ai" | "manual"
    items_json: str | None = None  # raw per-food breakdown from the model

    # "breakfast"|"lunch"|"dinner"|"snacks"; None (legacy rows) is read as "snacks".
    # Nullable with no DB CHECK so the additive migration works; validation is in Pydantic.
    meal: str | None = Field(default=None)

    # Visual-form food category for the entry-row icon (see app/categories.py). A Tier-1
    # group from the AI, a Tier-2 key from a barcode lookup, or None — the client resolver
    # falls back to keyword matching on food_name, so this is an accuracy boost, not required.
    category: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Targets(SQLModel, table=True):
    """Daily nutrition targets. Single row in v1 (mirrors FoodEntry's user_id-NULL pattern).

    Stores a calorie target plus a protein/carbs/fat percent-of-calories split; gram targets
    are derived client-side via Atwater factors (4/4/9), so they aren't persisted here.
    """

    __tablename__ = "targets"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    calorie_target: float = 2000.0
    protein_pct: float = 30.0  # % of calories from protein
    carbs_pct: float = 40.0
    fat_pct: float = 30.0

    # Body goals (optional). weekly_rate_kg is the target weight change per week
    # (negative = loss); feeds the TDEE-based target recommendation.
    goal_weight_kg: float | None = None
    goal_body_fat_pct: float | None = None
    weekly_rate_kg: float | None = None

    # Profile for BMR/TDEE (Mifflin-St Jeor). sex is 'male'|'female' (biological, for BMR);
    # activity_factor multiplies BMR (1.2 sedentary … 1.9 athlete).
    height_cm: float | None = None
    birth_year: int | None = None
    sex: str | None = None
    activity_factor: float | None = None

    updated_at: datetime = Field(default_factory=_utcnow)


class BodyMetric(SQLModel, table=True):
    """A daily body measurement: weight and/or body-fat %. One row per user per day.

    Weight is stored canonically in kilograms; the client converts for display (kg/lb).
    """

    __tablename__ = "body_metrics"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    date: date_cls = Field(index=True)  # local calendar day the measurement is for
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    steps: int | None = None  # daily step count; converted to kcal using that day's weight
    note: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class ExerciseEntry(SQLModel, table=True):
    """A logged workout/activity that burns calories. Multiple per day (like food entries).

    Calories are an estimate (AI from a free-text description, or entered manually).
    """

    __tablename__ = "exercise_entries"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)

    date: date_cls = Field(index=True)  # local calendar day the activity is for
    description: str
    duration_min: float | None = None
    calories: float = 0.0
    source: str = "manual"  # "manual" | "ai"

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
