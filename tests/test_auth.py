"""Auth flow tests. Google token verification is monkeypatched (no network); everything
else — allowlist, cookie/JWT round-trip, per-user scoping, owner backfill — is exercised
through the real endpoints with the unauthenticated ``anon_client``.
"""

from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient

from app.auth import AuthError
from app.db import engine
from app.main import app
from app.models import FoodEntry, Targets, User
from sqlmodel import Session, select


def _login(client, monkeypatch, email, sub=None, name="Tester"):
    """Drive POST /auth/google with a stubbed Google verification returning `email`."""
    claims = {"sub": sub or f"sub-{email}", "email": email, "email_verified": True, "name": name}
    monkeypatch.setattr("app.auth.verify_google_token", lambda credential, settings: claims)
    return client.post("/api/auth/google", json={"credential": "fake-google-token"})


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
