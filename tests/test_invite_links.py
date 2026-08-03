"""Shareable invite links: the owner gate, redemption through both providers, and spending.

conftest sets OWNER_EMAIL=owner@example.com, so owner@ is the owner and partner@ is a plain
invited user.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import invite_links, mailer
from app.db import engine
from app.main import app
from app.models import Invite, InviteLink, User, _utcnow

OWNER = "owner@example.com"
PARTNER = "partner@example.com"
NEWCOMER = "sam@example.com"


def _login(client, monkeypatch, email, sub=None):
    claims = {"sub": sub or f"sub-{email}", "email": email, "email_verified": True, "name": "T"}
    monkeypatch.setattr("app.auth.verify_google_token", lambda credential, settings: claims)
    return client.post("/api/auth/google", json={"credential": "fake"})


def _mint(client, **body) -> dict:
    r = client.post("/api/invites/links", json={"max_uses": 1, **body})
    assert r.status_code == 201, r.text
    return r.json()


def _token_of(url: str) -> str:
    return url.split("?invite=", 1)[1]


# --- The owner gate ---------------------------------------------------------


def test_owner_can_mint_a_link(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, OWNER)
    minted = _mint(anon_client, note="Sam at lunch")
    assert "?invite=" in minted["url"]
    assert minted["uses"] == 0 and minted["max_uses"] == 1


def test_me_reports_ownership_so_the_client_knows_whether_to_offer_invites(
    anon_client, monkeypatch
):
    _login(anon_client, monkeypatch, OWNER)
    assert anon_client.get("/api/auth/me").json()["is_owner"] is True


def test_a_signed_in_non_owner_is_refused_everywhere(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, PARTNER)
    assert anon_client.get("/api/auth/me").json()["is_owner"] is False

    assert anon_client.post("/api/invites/links", json={}).status_code == 403
    assert anon_client.get("/api/invites/links").status_code == 403
    assert anon_client.get("/api/invites").status_code == 403
    assert anon_client.delete("/api/invites/links/1").status_code == 403
    assert anon_client.delete(f"/api/invites/{NEWCOMER}").status_code == 403


def test_invite_routes_require_auth(anon_client):
    assert anon_client.post("/api/invites/links", json={}).status_code == 401
    assert anon_client.get("/api/invites").status_code == 401


def test_the_raw_url_is_returned_once_and_never_again(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, OWNER)
    minted = _mint(anon_client)

    listed = anon_client.get("/api/invites/links").json()
    assert len(listed) == 1
    assert "url" not in listed[0]  # only the hash is stored; the token is unrecoverable

    with Session(engine) as s:
        stored = s.exec(select(InviteLink)).one()
    assert _token_of(minted["url"]) != stored.token_hash


def test_owner_cannot_revoke_themselves(anon_client, monkeypatch):
    """That would lock the only account that can undo it out of the app."""
    _login(anon_client, monkeypatch, OWNER)
    assert anon_client.delete(f"/api/invites/{OWNER}").status_code == 400
    assert anon_client.get("/api/auth/me").status_code == 200


# --- Redeeming: Google ------------------------------------------------------


def test_google_sign_in_redeems_a_link(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, OWNER)
    token = _token_of(_mint(anon_client, note="gym")["url"])

    with TestClient(app) as guest:  # a second browser: the friend across the table
        claims = {"sub": "sub-sam", "email": NEWCOMER, "email_verified": True, "name": "Sam"}
        monkeypatch.setattr("app.auth.verify_google_token", lambda credential, settings: claims)
        r = guest.post("/api/auth/google", json={"credential": "fake", "invite_token": token})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == NEWCOMER
        assert r.json()["is_owner"] is False

    with Session(engine) as s:
        invite = s.exec(select(Invite).where(Invite.email == NEWCOMER)).one()
        link = s.exec(select(InviteLink)).one()
    assert invite.invited_by == "link" and invite.note == "gym"
    assert link.uses == 1


def test_without_the_link_the_same_person_is_refused(anon_client, monkeypatch):
    assert _login(anon_client, monkeypatch, NEWCOMER).status_code == 403


def test_a_single_use_link_works_exactly_once(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, OWNER)
    token = _token_of(_mint(anon_client, max_uses=1)["url"])

    with Session(engine) as s:
        invite_links.redeem_link(s, s.exec(select(InviteLink)).one(), NEWCOMER)

    # Spent: a second person can't ride the same link.
    with Session(engine) as s:
        assert invite_links.find_live(s, token) is None


def test_expired_and_revoked_links_are_dead(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, OWNER)
    expired = _token_of(_mint(anon_client)["url"])
    revoked = _token_of(_mint(anon_client)["url"])

    with Session(engine) as s:
        rows = s.exec(select(InviteLink).order_by(InviteLink.id)).all()
        rows[0].expires_at = _utcnow() - timedelta(minutes=1)
        rows[1].revoked_at = _utcnow()
        s.add(rows[0])
        s.add(rows[1])
        s.commit()

    with Session(engine) as s:
        assert invite_links.find_live(s, expired) is None
        assert invite_links.find_live(s, revoked) is None


def test_redeeming_for_someone_already_invited_does_not_spend_a_use(anon_client, monkeypatch):
    """Re-opening your own invite shouldn't quietly consume it."""
    _login(anon_client, monkeypatch, OWNER)
    _mint(anon_client, max_uses=1)

    with Session(engine) as s:
        link = s.exec(select(InviteLink)).one()
        invite_links.redeem_link(s, link, PARTNER)  # already on the guest list via the seed
        s.refresh(link)
        assert link.uses == 0


def test_revoking_a_link_leaves_earlier_joiners_alone(anon_client, monkeypatch):
    _login(anon_client, monkeypatch, OWNER)
    minted = _mint(anon_client, max_uses=5)

    with Session(engine) as s:
        link = s.exec(select(InviteLink)).one()
        invite_links.redeem_link(s, link, NEWCOMER)

    assert anon_client.delete(f"/api/invites/links/{minted['id']}").status_code == 204

    with Session(engine) as s:
        assert s.exec(select(Invite).where(Invite.email == NEWCOMER)).one().revoked_at is None


# --- Redeeming: email magic link -------------------------------------------


def test_email_sign_in_redeems_a_link_only_on_success(anon_client, monkeypatch):
    """The headline guarantee: a mistyped address must not burn a single-use invite."""
    sent: list[dict] = []
    monkeypatch.setattr(
        mailer,
        "send_email",
        lambda *, to, subject, text, settings: sent.append({"to": to, "text": text}),
    )

    _login(anon_client, monkeypatch, OWNER)
    token = _token_of(_mint(anon_client, max_uses=1)["url"])
    anon_client.post("/api/auth/logout")

    # The invite makes an unknown address worth mailing...
    r = anon_client.post(
        "/api/auth/email/request", json={"email": NEWCOMER, "invite_token": token}
    )
    assert r.status_code == 200
    assert sent and sent[-1]["to"] == NEWCOMER

    # ...but nothing is spent until they actually sign in.
    with Session(engine) as s:
        assert s.exec(select(InviteLink)).one().uses == 0
        assert s.exec(select(Invite).where(Invite.email == NEWCOMER)).first() is None

    link_token = next(
        ln for ln in sent[-1]["text"].splitlines() if "?token=" in ln
    ).split("?token=", 1)[1]
    assert (
        anon_client.post("/api/auth/email/verify", json={"token": link_token}).status_code == 200
    )

    with Session(engine) as s:
        assert s.exec(select(InviteLink)).one().uses == 1
        assert s.exec(select(Invite).where(Invite.email == NEWCOMER)).one().invited_by == "link"
        assert s.exec(select(User).where(User.email == NEWCOMER)).one() is not None


def test_a_bogus_invite_token_just_reads_as_not_allowed(anon_client, monkeypatch):
    """Never confirm to an anonymous caller whether a token they hold is real."""
    monkeypatch.setattr(
        "app.auth.verify_google_token",
        lambda credential, settings: {
            "sub": "s",
            "email": NEWCOMER,
            "email_verified": True,
            "name": "S",
        },
    )
    r = anon_client.post("/api/auth/google", json={"credential": "fake", "invite_token": "nope"})
    assert r.status_code == 403
    assert r.json()["detail"] == "This account isn't allowed to use this app."
