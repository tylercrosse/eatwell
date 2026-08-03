"""Guest-list behaviour: seeding from the env var, granting, revoking, and failing closed.

These drive ``app.accounts`` directly rather than through HTTP — the endpoint-level coverage
lives in test_auth.py. No TestClient is built here, so the app lifespan never runs and the
invites table starts genuinely empty (``clean_db`` wiped it).
"""

from __future__ import annotations

import pytest
from sqlmodel import Session, select

from app.accounts import AccessDenied, ensure_allowed, grant, revoke, seed_invites
from app.config import get_settings
from app.db import engine
from app.models import Invite, User

# conftest sets ALLOWED_EMAILS="owner@example.com,partner@example.com", OWNER_EMAIL=owner@.
SEEDED = {"owner@example.com", "partner@example.com"}


# --- Seeding ----------------------------------------------------------------


def test_seed_creates_rows_for_allowed_emails_and_owner():
    with Session(engine) as s:
        assert seed_invites(s, get_settings()) == len(SEEDED)
        assert {i.email for i in s.exec(select(Invite)).all()} == SEEDED
        assert all(i.invited_by == "seed" for i in s.exec(select(Invite)).all())


def test_seeding_twice_creates_no_duplicates():
    with Session(engine) as s:
        seed_invites(s, get_settings())
        assert seed_invites(s, get_settings()) == 0
        assert len(s.exec(select(Invite)).all()) == len(SEEDED)


def test_seeding_does_not_resurrect_a_revoked_invite():
    """Otherwise every restart would silently re-admit anyone still in ALLOWED_EMAILS."""
    with Session(engine) as s:
        seed_invites(s, get_settings())
        revoke(s, "partner@example.com")

        seed_invites(s, get_settings())

        invite = s.exec(select(Invite).where(Invite.email == "partner@example.com")).first()
        assert invite.revoked_at is not None


def test_seed_includes_owner_email_not_in_the_allowlist(monkeypatch):
    """A fresh DB must always let the owner back in, even with ALLOWED_EMAILS unset."""
    settings = get_settings()
    monkeypatch.setattr(settings, "allowed_emails", "")
    with Session(engine) as s:
        assert seed_invites(s, settings) == 1
        assert {i.email for i in s.exec(select(Invite)).all()} == {"owner@example.com"}


def test_seed_grandfathers_existing_accounts(monkeypatch):
    """Switching to fail-closed must not evict people who already had accounts.

    A blank ALLOWED_EMAILS used to mean "allow everyone", so most existing users are not named
    in it. Without this they'd be locked out by the very deploy that adds the guest list.
    """
    settings = get_settings()
    monkeypatch.setattr(settings, "allowed_emails", "")
    monkeypatch.setattr(settings, "owner_email", "")
    with Session(engine) as s:
        _seed_user(s, "already.here@example.com")

        assert seed_invites(s, settings) == 1
        invite = s.exec(select(Invite).where(Invite.email == "already.here@example.com")).one()
        assert invite.invited_by == "existing"
        assert ensure_allowed(s, settings, "already.here@example.com") is not None


def test_seed_does_not_re_admit_a_revoked_existing_account(monkeypatch):
    """The grandfather clause must not become a back door that undoes a revocation."""
    settings = get_settings()
    monkeypatch.setattr(settings, "allowed_emails", "")
    monkeypatch.setattr(settings, "owner_email", "")
    with Session(engine) as s:
        _seed_user(s, "removed@example.com")
        seed_invites(s, settings)
        revoke(s, "removed@example.com")

        seed_invites(s, settings)

        with pytest.raises(AccessDenied):
            ensure_allowed(s, settings, "removed@example.com")


# --- The gate ---------------------------------------------------------------


def test_empty_guest_list_fails_closed():
    """Blank ALLOWED_EMAILS used to admit every verified Google account. It must not."""
    with Session(engine) as s, pytest.raises(AccessDenied):
        ensure_allowed(s, get_settings(), "anyone@example.com")


def test_allow_open_signup_admits_anyone(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "allow_open_signup", True)
    with Session(engine) as s:
        assert ensure_allowed(s, settings, "anyone@example.com") is None


def test_ensure_allowed_ignores_case_and_surrounding_whitespace():
    with Session(engine) as s:
        grant(s, "  Friend@Example.COM  ")
        assert ensure_allowed(s, get_settings(), "friend@example.com") is not None


# --- Grant / revoke keep both tables in step --------------------------------


def _seed_user(session: Session, email: str) -> None:
    session.add(User(google_sub=f"email:{email}", email=email))
    session.commit()


def test_revoke_denies_signin_and_disables_the_live_session():
    with Session(engine) as s:
        grant(s, "friend@example.com")
        _seed_user(s, "friend@example.com")

        revoke(s, "friend@example.com")

        with pytest.raises(AccessDenied):
            ensure_allowed(s, get_settings(), "friend@example.com")
        user = s.exec(select(User).where(User.email == "friend@example.com")).first()
        assert user.disabled_at is not None


def test_grant_restores_a_revoked_invite_and_re_enables_the_user():
    with Session(engine) as s:
        grant(s, "friend@example.com")
        _seed_user(s, "friend@example.com")
        revoke(s, "friend@example.com")

        grant(s, "friend@example.com")  # grant doubles as restore

        assert ensure_allowed(s, get_settings(), "friend@example.com") is not None
        user = s.exec(select(User).where(User.email == "friend@example.com")).first()
        assert user.disabled_at is None


def test_revoking_an_uninvited_email_is_a_noop():
    with Session(engine) as s:
        assert revoke(s, "nobody@example.com") is None
