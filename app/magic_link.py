"""Magic-link sign-in: minting, verifying, and rate limiting.

A request mints a :class:`LoginToken` and emails the raw token as a link plus a 6-digit code;
a verify consumes it. Only hashes are persisted.

Both a link and a code ship because an installed home-screen PWA on iOS has a cookie jar
separate from Safari: a link tapped in Mail signs you in *in Safari* while the installed app
still shows the login screen. Typing the code into the app itself sidesteps that, and also
defuses email link-scanners that would otherwise burn a single-use token.

Rate limiting counts rows in this table rather than keeping counters in memory. ``fly.toml``
sets ``auto_stop_machines`` with ``min_machines_running = 0``, so the machine halts whenever
it's idle — an in-memory counter would reset most of the day, and would be wrong outright the
moment a second instance existed.

**Every window comparison happens in the SQL WHERE clause on purpose.** SQLAlchemy strips
tzinfo on write, so stored values come back naive; comparing one against an aware
``datetime`` in Python raises TypeError.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from sqlmodel import Session, col, delete, func, select

from app.config import Settings
from app.models import LoginToken, _utcnow


class LinkError(RuntimeError):
    """The token or code is unknown, expired, or already used. Routers map this to 401."""


class TooManyAttempts(LinkError):
    """The wrong-code guess cap was hit. Routers map this to 429."""


def _hash(raw: str) -> str:
    """sha256 hex. Lookups are by hash, so no constant-time compare is needed — the index does
    an exact match on an unguessable 256-bit value, and a timing difference on a hash column
    reveals nothing about the secret."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _new_code() -> str:
    """A 6-digit code, uniformly random including leading zeros."""
    return f"{secrets.randbelow(1_000_000):06d}"


def client_ip(headers, fallback: str | None, settings: Settings) -> str | None:
    """The caller's IP, read from the trusted proxy header when one is configured.

    Behind the Fly proxy ``request.client.host`` is the *proxy*, so every request would share
    one address and the per-IP limit would lock out everybody at once. The header is only
    trusted when ``TRUSTED_CLIENT_IP_HEADER`` names one, since it's trivially spoofable
    otherwise.
    """
    name = (settings.trusted_client_ip_header or "").strip()
    if name:
        forwarded = headers.get(name)
        if forwarded:
            # A comma-separated chain means the closest proxy appended; take the first entry.
            return forwarded.split(",")[0].strip()
    return fallback


def purge_expired(session: Session, settings: Settings) -> None:
    """Drop rows older than a day. Keeps the rate-limit scans small and expires stored IPs."""
    cutoff = _utcnow() - timedelta(seconds=max(settings.login_token_retention_seconds, 0))
    session.exec(delete(LoginToken).where(col(LoginToken.created_at) < cutoff))
    session.commit()


def _count_since(session: Session, column, value: str, seconds: int) -> int:
    cutoff = _utcnow() - timedelta(seconds=seconds)
    return session.exec(
        select(func.count())
        .select_from(LoginToken)
        .where(column == value)
        .where(col(LoginToken.created_at) >= cutoff)
    ).one()


def over_ip_limit(session: Session, settings: Settings, ip: str | None) -> bool:
    if not ip:
        return False
    used = _count_since(session, col(LoginToken.request_ip), ip, 3600)
    return used >= settings.login_requests_per_ip_per_hour


def over_email_limit(session: Session, settings: Settings, email: str) -> bool:
    used = _count_since(session, col(LoginToken.email), email, 3600)
    return used >= settings.login_requests_per_email_per_hour


def mint(
    session: Session, settings: Settings, *, email: str, request_ip: str | None, sent: bool
) -> tuple[str, str]:
    """Create a pending sign-in and return ``(raw_token, code)``.

    The raw values exist only in this return and in the email. ``sent=False`` records an
    attempt we deliberately didn't deliver, so abuse still shows up in the per-IP count.
    """
    raw_token = secrets.token_urlsafe(32)
    code = _new_code()
    session.add(
        LoginToken(
            email=email,
            token_hash=_hash(raw_token),
            code_hash=_hash(code),
            request_ip=request_ip,
            sent=sent,
            expires_at=_utcnow() + timedelta(seconds=settings.login_token_ttl_seconds),
        )
    )
    session.commit()
    return raw_token, code


def _live(query):
    """Restrict to unconsumed, unexpired rows — filtered in SQL, see the module docstring."""
    return query.where(col(LoginToken.consumed_at).is_(None)).where(
        col(LoginToken.expires_at) > _utcnow()
    )


def consume_token(session: Session, raw_token: str) -> LoginToken:
    """Redeem a magic link. Raises :class:`LinkError` if unknown, expired, or already used."""
    row = session.exec(
        _live(select(LoginToken).where(LoginToken.token_hash == _hash(raw_token)))
    ).first()
    if row is None:
        raise LinkError("This sign-in link has expired or was already used. Request a new one.")
    return _mark_consumed(session, row)


def consume_code(session: Session, settings: Settings, *, email: str, code: str) -> LoginToken:
    """Redeem a typed code against the newest live token for ``email``.

    A wrong guess costs an attempt; past the cap the row is retired so the code can't be
    brute-forced by requesting one email and guessing at leisure.
    """
    row = session.exec(
        _live(select(LoginToken).where(LoginToken.email == email)).order_by(
            col(LoginToken.created_at).desc()
        )
    ).first()
    if row is None:
        raise LinkError("This sign-in code has expired or was already used. Request a new one.")

    if row.code_hash is None or not secrets.compare_digest(row.code_hash, _hash(code)):
        row.attempts += 1
        exhausted = row.attempts >= settings.login_code_max_attempts
        if exhausted:
            row.consumed_at = _utcnow()  # retire it; a fresh code is required
        session.add(row)
        session.commit()
        if exhausted:
            raise TooManyAttempts("Too many attempts. Request a new code.")
        raise LinkError("That code isn't right.")

    return _mark_consumed(session, row)


def _mark_consumed(session: Session, row: LoginToken) -> LoginToken:
    """Consume ``row`` and retire every other live token for the same address.

    Signing in should invalidate the links from earlier attempts, so a forwarded or
    still-sitting-in-the-inbox message can't be replayed later.
    """
    now = _utcnow()
    row.consumed_at = now
    session.add(row)
    for other in session.exec(
        _live(select(LoginToken).where(LoginToken.email == row.email)).where(LoginToken.id != row.id)
    ).all():
        other.consumed_at = now
        session.add(other)
    session.commit()
    session.refresh(row)
    return row


def build_link(settings: Settings, raw_token: str) -> str:
    """The URL that goes in the email.

    Built from ``APP_BASE_URL`` and never from the request's Host header — that would be host
    header injection, letting an attacker mint a link pointing at a domain they control and
    harvest the token when the victim clicks it.

    The token rides on ``/`` rather than a path like ``/auth/verify`` for two reasons: the
    static mount serves ``index.html`` for ``/`` but 404s unknown paths on a cold hit, and a
    plain GET here has no side effect — consumption is a separate same-origin POST, so link
    prefetchers and mail scanners can't burn the token by merely fetching it.
    """
    return f"{settings.app_base_url.rstrip('/')}/?token={raw_token}"


def compose_email(settings: Settings, *, link: str, code: str) -> tuple[str, str]:
    """Return ``(subject, body)`` for a sign-in email."""
    minutes = max(settings.login_token_ttl_seconds // 60, 1)
    body = (
        "Tap the link below to sign in:\n\n"
        f"{link}\n\n"
        f"Or enter this code in the app: {code}\n\n"
        f"It expires in {minutes} minutes and can only be used once.\n"
        "If you didn't ask to sign in, you can ignore this email."
    )
    return f"{settings.app_title}: your sign-in link", body
