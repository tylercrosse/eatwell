"""Auth flow tests. Google token verification is monkeypatched (no network); everything
else — allowlist, cookie/JWT round-trip, per-user scoping, owner backfill — is exercised
through the real endpoints with the unauthenticated ``anon_client``.
"""

from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient

from app.accounts import resolve_login, revoke
from app.auth import AuthError
from app.config import get_settings
from app.db import engine
from app.main import app
from app.models import AuthIdentity, FoodEntry, Invite, Targets, User
from sqlmodel import Session, delete, select

QA_SECRET = "local-qa-secret"


def _login(client, monkeypatch, email, sub=None, name="Tester"):
    """Drive POST /auth/google with a stubbed Google verification returning `email`."""
    claims = {"sub": sub or f"sub-{email}", "email": email, "email_verified": True, "name": name}
    monkeypatch.setattr("app.auth.verify_google_token", lambda credential, settings: claims)
    return client.post("/api/auth/google", json={"credential": "fake-google-token"})


def _enable_qa(
    monkeypatch,
    accounts=(
        "qa-loss|qa-loss@example.test|QA Loss,"
        "qa-gain|qa-gain@example.test|QA Gain,"
        "qa-sporadic|qa-sporadic@example.test|QA Sporadic"
    ),
):
    settings = get_settings()
    monkeypatch.setattr(settings, "qa_auth_enabled", True)
    monkeypatch.setattr(settings, "qa_auth_secret", QA_SECRET)
    monkeypatch.setattr(settings, "qa_auth_accounts", accounts)


def _qa_login(client, account="qa-loss", secret=QA_SECRET):
    return client.post("/api/auth/qa", json={"account": account, "secret": secret})


def _all_users() -> list[User]:
    with Session(engine) as s:
        return s.exec(select(User)).all()


# --- Gate ------------------------------------------------------------------


def test_health_is_public(anon_client):
    assert anon_client.get("/api/health").status_code == 200


def test_protected_endpoints_require_auth(anon_client):
    assert anon_client.get("/api/entries", params={"date": "2026-05-31"}).status_code == 401
    assert anon_client.get("/api/targets").status_code == 401
    assert anon_client.get("/api/foods/recent").status_code == 401
    assert anon_client.post("/api/entries", json={"food_name": "X"}).status_code == 401


# --- Login ------------------------------------------------------------------


def test_login_succeeds_for_allowlisted_email(anon_client, monkeypatch):
    r = _login(anon_client, monkeypatch, "owner@example.com")
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "owner@example.com"


def test_login_rejects_non_allowlisted_email(anon_client, monkeypatch):
    assert _login(anon_client, monkeypatch, "stranger@example.com").status_code == 403


def test_login_rejects_invalid_google_token(anon_client, monkeypatch):
    def boom(credential, settings):
        raise AuthError("bad token")

    monkeypatch.setattr("app.auth.verify_google_token", boom)
    assert anon_client.post("/api/auth/google", json={"credential": "x"}).status_code == 401


def test_me_requires_auth(anon_client):
    assert anon_client.get("/api/auth/me").status_code == 401


def test_login_then_me_and_logout(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, "owner@example.com")
    me = anon_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "owner@example.com"

    anon_client.post("/api/auth/logout")
    assert anon_client.get("/api/auth/me").status_code == 401


def test_login_is_idempotent_for_same_google_sub(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, "owner@example.com", sub="stable-sub")
    _login(anon_client, monkeypatch, "owner@example.com", sub="stable-sub")
    with Session(engine) as s:
        assert len(s.exec(select(User)).all()) == 1


# --- Local QA login ---------------------------------------------------------


def test_qa_login_is_disabled_by_default(anon_client):
    assert _qa_login(anon_client).status_code == 401
    assert _all_users() == []


def test_qa_login_succeeds_for_configured_local_account(monkeypatch):
    _enable_qa(monkeypatch)
    with TestClient(app, base_url="http://localhost") as c:
        r = _qa_login(c)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == "qa-loss@example.test"
        assert r.json()["name"] == "QA Loss"

        me = c.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == "qa-loss@example.test"

    users = _all_users()
    assert len(users) == 1
    assert users[0].google_sub == "qa:qa-loss"


def test_qa_login_rejects_invalid_secret_without_creating_user(monkeypatch):
    _enable_qa(monkeypatch)
    with TestClient(app, base_url="http://localhost") as c:
        assert _qa_login(c, secret="wrong").status_code == 401
    assert _all_users() == []


def test_qa_login_rejects_unknown_account_without_creating_user(monkeypatch):
    _enable_qa(monkeypatch)
    with TestClient(app, base_url="http://localhost") as c:
        assert _qa_login(c, account="missing").status_code == 401
    assert _all_users() == []


def test_qa_login_rejects_non_local_host_without_creating_user(anon_client, monkeypatch):
    _enable_qa(monkeypatch)
    assert _qa_login(anon_client).status_code == 403
    assert _all_users() == []


def test_qa_login_does_not_claim_owner_orphan_rows(monkeypatch):
    _enable_qa(monkeypatch, accounts="owner|owner@example.com|QA Owner")
    _seed_orphan_rows()

    with TestClient(app, base_url="http://localhost") as c:
        assert _qa_login(c, account="owner").status_code == 200
        assert c.get("/api/entries").json() == []


# --- Per-user scoping -------------------------------------------------------


def test_users_only_see_their_own_entries(monkeypatch):
    with TestClient(app) as a, TestClient(app) as b:
        _login(a, monkeypatch, "owner@example.com", sub="sub-a")
        _login(b, monkeypatch, "partner@example.com", sub="sub-b")

        a.post("/api/entries", json={"food_name": "A food", "calories": 100})
        b.post("/api/entries", json={"food_name": "B food", "calories": 200})

        assert [e["food_name"] for e in a.get("/api/entries").json()] == ["A food"]
        assert [e["food_name"] for e in b.get("/api/entries").json()] == ["B food"]


def test_cannot_read_another_users_entry_by_id(monkeypatch):
    with TestClient(app) as a, TestClient(app) as b:
        _login(a, monkeypatch, "owner@example.com", sub="sub-a")
        created = a.post("/api/entries", json={"food_name": "A food", "calories": 100}).json()

        _login(b, monkeypatch, "partner@example.com", sub="sub-b")
        assert b.get(f"/api/entries/{created['id']}").status_code == 404
        assert b.delete(f"/api/entries/{created['id']}").status_code == 404


# --- Owner backfill of pre-auth rows ---------------------------------------


def _seed_orphan_rows():
    with Session(engine) as s:
        s.add(FoodEntry(user_id=None, logged_at=datetime(2026, 5, 31, 8, 0, 0),
                        food_name="Legacy", calories=100))
        s.add(Targets(user_id=None))
        s.commit()


def test_owner_first_login_claims_orphan_rows(anon_client, monkeypatch):
    _seed_orphan_rows()
    _login(anon_client, monkeypatch, "owner@example.com")  # OWNER_EMAIL in conftest
    names = [e["food_name"] for e in anon_client.get("/api/entries").json()]
    assert "Legacy" in names
    assert anon_client.get("/api/targets").json()["calorie_target"] == 2000.0  # adopted row


def test_non_owner_login_does_not_claim_orphan_rows(anon_client, monkeypatch):
    _seed_orphan_rows()
    _login(anon_client, monkeypatch, "partner@example.com")  # allowlisted but not owner
    assert anon_client.get("/api/entries").json() == []


# --- Multi-provider identity ------------------------------------------------


def test_login_records_a_google_auth_identity_once(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, "owner@example.com", sub="stable-sub")
    _login(anon_client, monkeypatch, "owner@example.com", sub="stable-sub")
    with Session(engine) as s:
        identities = s.exec(select(AuthIdentity)).all()
    assert len(identities) == 1
    assert (identities[0].provider, identities[0].provider_subject) == ("google", "stable-sub")


def test_qa_login_records_a_qa_identity_and_auto_invites(monkeypatch):
    """QA goes through the same funnel as everyone else rather than skipping the guest list."""
    _enable_qa(monkeypatch)
    with TestClient(app, base_url="http://localhost") as c:
        assert _qa_login(c).status_code == 200

    with Session(engine) as s:
        identity = s.exec(select(AuthIdentity)).one()
        invite = s.exec(select(Invite).where(Invite.email == "qa-loss@example.test")).first()
    assert (identity.provider, identity.provider_subject) == ("qa", "qa-loss")
    assert invite is not None and invite.invited_by == "qa"


def test_a_second_provider_with_the_same_email_reuses_the_account(anon_client, monkeypatch):
    """A friend who used Google and later signs in by email must not get a second account."""
    _login(anon_client, monkeypatch, "owner@example.com", sub="google-sub")

    with Session(engine) as s:
        _, is_new = resolve_login(
            s,
            get_settings(),
            provider="email",
            subject="owner@example.com",
            email="owner@example.com",
        )
        assert is_new is False
        assert len(s.exec(select(User)).all()) == 1
        assert len(s.exec(select(AuthIdentity)).all()) == 2


# --- Guest list -------------------------------------------------------------


def test_login_fails_closed_when_the_guest_list_is_empty(anon_client, monkeypatch):
    """Blank ALLOWED_EMAILS used to admit every verified Google account. It must not."""
    monkeypatch.setattr(get_settings(), "allowed_emails", "")
    with Session(engine) as s:
        s.exec(delete(Invite))
        s.commit()

    assert _login(anon_client, monkeypatch, "anyone@example.com").status_code == 403


def test_open_signup_admits_any_verified_google_account(anon_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "allow_open_signup", True)
    assert _login(anon_client, monkeypatch, "stranger@example.com").status_code == 200


def test_revoking_access_ends_the_session_on_the_next_request(anon_client, monkeypatch):
    """Sessions are 30-day JWTs, so revocation is checked per request, not at expiry."""
    _login(anon_client, monkeypatch, "partner@example.com")
    assert anon_client.get("/api/auth/me").status_code == 200

    with Session(engine) as s:
        revoke(s, "partner@example.com")

    assert anon_client.get("/api/auth/me").status_code == 401
