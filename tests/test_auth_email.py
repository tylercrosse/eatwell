"""Magic-link sign-in through the real endpoints. The mailer is stubbed at the router's
module reference (the house pattern), so nothing leaves the process.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlmodel import Session, select

from app import mailer
from app.accounts import grant, revoke
from app.config import get_settings
from app.db import engine
from app.models import AuthIdentity, LoginToken, User, _utcnow

INVITED = "friend@example.com"


@pytest.fixture
def outbox(monkeypatch) -> list[dict]:
    """Capture would-be emails. Patched on the mailer module the router calls through."""
    sent: list[dict] = []

    def fake_send(*, to, subject, text, settings):
        sent.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr(mailer, "send_email", fake_send)
    return sent


def _invite(email: str = INVITED) -> None:
    with Session(engine) as s:
        grant(s, email)


def _request(client, email: str = INVITED, **kwargs):
    return client.post("/api/auth/email/request", json={"email": email}, **kwargs)


def _link_token(text: str) -> str:
    """Pull the raw token out of the emailed link."""
    line = next(ln for ln in text.splitlines() if "?token=" in ln)
    return line.split("?token=", 1)[1].strip()


def _code(text: str) -> str:
    line = next(ln for ln in text.splitlines() if "enter this code" in ln)
    return line.rsplit(":", 1)[1].strip()


def _tokens() -> list[LoginToken]:
    with Session(engine) as s:
        return s.exec(select(LoginToken)).all()


# --- Requesting -------------------------------------------------------------


def test_invited_email_receives_a_link(anon_client, outbox):
    _invite()
    r = _request(anon_client)
    assert r.status_code == 200, r.text
    assert r.json() == {"sent": True}
    assert len(outbox) == 1 and outbox[0]["to"] == INVITED

    rows = _tokens()
    assert len(rows) == 1 and rows[0].sent is True
    # Only hashes are persisted — the raw token exists in the email and nowhere else.
    assert _link_token(outbox[0]["text"]) not in (rows[0].token_hash, rows[0].code_hash)


def test_uninvited_email_gets_an_identical_response_and_no_mail(anon_client, outbox):
    invited = _request(anon_client)
    _invite("someone.else@example.com")
    uninvited = anon_client.post(
        "/api/auth/email/request", json={"email": "stranger@example.com"}
    )

    assert uninvited.status_code == invited.status_code == 200
    assert uninvited.json() == invited.json() == {"sent": True}
    assert outbox == []  # nobody was invited at the time of either call


def test_declined_requests_are_still_recorded_for_rate_limiting(anon_client, outbox):
    """Otherwise someone spraying uninvited addresses is invisible to the per-IP counter."""
    _request(anon_client, "stranger@example.com")
    rows = _tokens()
    assert len(rows) == 1 and rows[0].sent is False
    assert outbox == []


def test_malformed_email_is_rejected(anon_client, outbox):
    assert _request(anon_client, "not-an-email").status_code == 422
    assert outbox == []


def test_link_uses_app_base_url_not_the_host_header(anon_client, outbox, monkeypatch):
    """Host-header injection would let an attacker harvest tokens via their own domain."""
    monkeypatch.setattr(get_settings(), "app_base_url", "https://real.example.com")
    _invite()

    _request(anon_client, headers={"Host": "evil.example.com"})

    link = next(ln for ln in outbox[0]["text"].splitlines() if "?token=" in ln)
    assert link.startswith("https://real.example.com/?token=")
    assert "evil.example.com" not in outbox[0]["text"]


def test_per_email_limit_stops_sending_but_still_returns_200(anon_client, outbox, monkeypatch):
    """A 429 here would reveal that someone else is requesting links for that address."""
    monkeypatch.setattr(get_settings(), "login_requests_per_email_per_hour", 2)
    _invite()

    for _ in range(2):
        assert _request(anon_client).status_code == 200
    third = _request(anon_client)

    assert third.status_code == 200
    assert third.json() == {"sent": True}  # indistinguishable from a real send
    assert len(outbox) == 2  # but no third email went out


def test_per_ip_limit_returns_429(anon_client, outbox, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "login_requests_per_ip_per_hour", 2)
    monkeypatch.setattr(settings, "trusted_client_ip_header", "fly-client-ip")
    _invite()

    headers = {"fly-client-ip": "203.0.113.7"}
    for _ in range(2):
        assert _request(anon_client, headers=headers).status_code == 200
    assert _request(anon_client, headers=headers).status_code == 429

    # A different caller is unaffected.
    assert _request(anon_client, headers={"fly-client-ip": "203.0.113.8"}).status_code == 200


def test_email_send_failure_is_a_502_without_upstream_detail(anon_client, monkeypatch):
    def boom(*, to, subject, text, settings):
        raise mailer.EmailError("SMTP send failed: mail.internal refused relay")

    monkeypatch.setattr(mailer, "send_email", boom)
    _invite()

    r = _request(anon_client)
    assert r.status_code == 502
    assert "internal" not in r.json()["detail"]  # no server detail to anonymous callers


def test_unconfigured_provider_is_a_503_naming_the_setting(anon_client, monkeypatch):
    def boom(*, to, subject, text, settings):
        raise mailer.EmailNotConfigured("SMTP_HOST is not configured.")

    monkeypatch.setattr(mailer, "send_email", boom)
    _invite()

    r = _request(anon_client)
    assert r.status_code == 503
    assert "SMTP_HOST" in r.json()["detail"]  # a deploy mistake, safe to report


# --- Verifying --------------------------------------------------------------


def test_link_signs_in_and_records_an_email_identity(anon_client, outbox):
    _invite()
    _request(anon_client)

    r = anon_client.post(
        "/api/auth/email/verify", json={"token": _link_token(outbox[0]["text"])}
    )
    assert r.status_code == 200, r.text
    assert r.json()["email"] == INVITED
    assert anon_client.get("/api/auth/me").json()["email"] == INVITED

    with Session(engine) as s:
        identity = s.exec(select(AuthIdentity)).one()
    assert (identity.provider, identity.provider_subject) == ("email", INVITED)


def test_typed_code_signs_in(anon_client, outbox):
    """The code is what rescues an installed iOS PWA, whose cookie jar isn't Safari's."""
    _invite()
    _request(anon_client)

    r = anon_client.post(
        "/api/auth/email/verify",
        json={"email": INVITED, "code": _code(outbox[0]["text"])},
    )
    assert r.status_code == 200, r.text
    assert anon_client.get("/api/auth/me").json()["email"] == INVITED


def test_a_link_cannot_be_replayed(anon_client, outbox):
    _invite()
    _request(anon_client)
    token = _link_token(outbox[0]["text"])

    assert anon_client.post("/api/auth/email/verify", json={"token": token}).status_code == 200
    assert anon_client.post("/api/auth/email/verify", json={"token": token}).status_code == 401


def test_expired_link_is_refused(anon_client, outbox):
    _invite()
    _request(anon_client)
    token = _link_token(outbox[0]["text"])

    with Session(engine) as s:
        row = s.exec(select(LoginToken)).one()
        row.expires_at = _utcnow() - timedelta(minutes=1)
        s.add(row)
        s.commit()

    assert anon_client.post("/api/auth/email/verify", json={"token": token}).status_code == 401


def test_unknown_token_is_refused(anon_client):
    r = anon_client.post("/api/auth/email/verify", json={"token": "never-issued"})
    assert r.status_code == 401


def test_verify_needs_a_token_or_an_email_and_code(anon_client):
    assert anon_client.post("/api/auth/email/verify", json={}).status_code == 422
    assert anon_client.post("/api/auth/email/verify", json={"email": INVITED}).status_code == 422


def test_wrong_code_is_refused_and_capped(anon_client, outbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "login_code_max_attempts", 3)
    _invite()
    _request(anon_client)

    for _ in range(2):
        r = anon_client.post(
            "/api/auth/email/verify", json={"email": INVITED, "code": "000000"}
        )
        assert r.status_code == 401
    assert (
        anon_client.post(
            "/api/auth/email/verify", json={"email": INVITED, "code": "000000"}
        ).status_code
        == 429
    )

    # Burned: even the correct code no longer works, so it can't be brute-forced at leisure.
    assert (
        anon_client.post(
            "/api/auth/email/verify", json={"email": INVITED, "code": _code(outbox[0]["text"])}
        ).status_code
        == 401
    )


def test_signing_in_retires_earlier_outstanding_links(anon_client, outbox):
    """A forwarded or still-unread earlier email must not stay usable."""
    _invite()
    _request(anon_client)
    _request(anon_client)
    first, second = (_link_token(m["text"]) for m in outbox)

    assert anon_client.post("/api/auth/email/verify", json={"token": second}).status_code == 200
    assert anon_client.post("/api/auth/email/verify", json={"token": first}).status_code == 401


def test_revoking_between_request_and_verify_denies_sign_in(anon_client, outbox):
    _invite()
    _request(anon_client)
    token = _link_token(outbox[0]["text"])

    with Session(engine) as s:
        revoke(s, INVITED)

    r = anon_client.post("/api/auth/email/verify", json={"token": token})
    assert r.status_code == 403


def test_email_sign_in_reuses_an_existing_google_account(anon_client, outbox, monkeypatch):
    """The headline linking rule: no duplicate account for someone who already used Google."""
    claims = {
        "sub": "google-sub-1",
        "email": "owner@example.com",
        "email_verified": True,
        "name": "Owner",
    }
    monkeypatch.setattr("app.auth.verify_google_token", lambda credential, settings: claims)
    assert (
        anon_client.post("/api/auth/google", json={"credential": "x"}).status_code == 200
    )

    _request(anon_client, "owner@example.com")
    assert (
        anon_client.post(
            "/api/auth/email/verify", json={"token": _link_token(outbox[0]["text"])}
        ).status_code
        == 200
    )

    with Session(engine) as s:
        assert len(s.exec(select(User)).all()) == 1
        assert {i.provider for i in s.exec(select(AuthIdentity)).all()} == {"google", "email"}
