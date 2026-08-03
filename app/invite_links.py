"""Shareable invite links — handing someone access in person.

The scenario this exists for: you're out, someone sees you tracking, and you want them using
the app before the check arrives. Everything else (editing an env var, a CLI over
``fly ssh console``, typing their address into your phone and waiting on email at the table)
either needs a laptop or is too slow to do socially.

So: mint a link, share it, they open it and sign in with whichever provider suits them. The
link only *authorises* signup — it doesn't identify anyone. Whoever redeems it gets an
:class:`Invite` for the address they actually prove control of.

Depends on :mod:`app.accounts` for granting, never the reverse, so the import graph stays
acyclic; the routers wire the two together.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from sqlmodel import Session, col, select

from app.accounts import grant, normalize_email
from app.config import Settings
from app.models import Invite, InviteLink, _utcnow


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def mint(
    session: Session,
    settings: Settings,
    *,
    created_by_user_id: int,
    note: str | None = None,
    max_uses: int = 1,
) -> tuple[InviteLink, str]:
    """Create a link and return ``(row, raw_token)``.

    The raw token is returned exactly once and never stored — only its hash is. Losing it means
    minting another, which is the right trade for a credential that grants account creation.
    """
    raw = secrets.token_urlsafe(32)
    link = InviteLink(
        token_hash=_hash(raw),
        created_by_user_id=created_by_user_id,
        note=note,
        max_uses=max(1, min(max_uses, settings.invite_link_max_uses)),
        expires_at=_utcnow() + timedelta(seconds=settings.invite_link_ttl_seconds),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link, raw


def find_live(session: Session, raw_token: str) -> InviteLink | None:
    """The usable link for ``raw_token``, or None if unknown, expired, revoked, or spent.

    Expiry is filtered in SQL: SQLAlchemy strips tzinfo on write, so a stored value compared
    against an aware datetime in Python raises TypeError.
    """
    if not raw_token:
        return None
    return session.exec(
        select(InviteLink)
        .where(InviteLink.token_hash == _hash(raw_token))
        .where(col(InviteLink.revoked_at).is_(None))
        .where(col(InviteLink.expires_at) > _utcnow())
        .where(col(InviteLink.uses) < col(InviteLink.max_uses))
    ).first()


def redeem_link(session: Session, link: InviteLink, email: str) -> InviteLink:
    """Grant ``email`` access on the strength of an already-resolved ``link``.

    Redeeming for someone who already has access is a no-op that does **not** spend a use —
    otherwise re-opening your own invite would quietly consume it.
    """
    email = normalize_email(email)
    existing = session.exec(select(Invite).where(Invite.email == email)).first()
    if existing is not None and existing.revoked_at is None:
        return link  # already welcome; don't spend a use

    link.uses += 1
    session.add(link)
    grant(session, email, invited_by="link", note=link.note)
    session.commit()
    session.refresh(link)
    return link


def redeem(session: Session, settings: Settings, raw_token: str, email: str) -> InviteLink | None:
    """Grant ``email`` access on the strength of ``raw_token``. Returns the link, or None.

    Silent on a bad token: the caller then falls through to the normal guest-list check and
    gets an ordinary "not allowed", which avoids telling an anonymous caller whether a token
    they hold is real.
    """
    link = find_live(session, raw_token)
    if link is None:
        return None
    return redeem_link(session, link, email)


def revoke(session: Session, settings: Settings, link_id: int) -> InviteLink | None:
    """Kill a link. People who already joined through it keep their access."""
    link = session.get(InviteLink, link_id)
    if link is None:
        return None
    link.revoked_at = _utcnow()
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def outstanding(session: Session) -> list[InviteLink]:
    """Links that could still be used by someone, newest first."""
    return list(
        session.exec(
            select(InviteLink)
            .where(col(InviteLink.revoked_at).is_(None))
            .where(col(InviteLink.expires_at) > _utcnow())
            .where(col(InviteLink.uses) < col(InviteLink.max_uses))
            .order_by(col(InviteLink.created_at).desc())
        ).all()
    )


def build_share_url(settings: Settings, raw_token: str) -> str:
    """The URL to hand over.

    Same reasoning as the sign-in link: built from ``APP_BASE_URL`` rather than the request's
    Host header, and hung off ``/`` because the static mount 404s unknown paths on a cold hit.
    """
    return f"{settings.app_base_url.rstrip('/')}/?invite={raw_token}"
