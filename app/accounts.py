"""Account resolution: the one funnel every sign-in passes through.

Google, the email magic link, and the local QA login all turn a verified assertion into a
session by calling :func:`resolve_login`. The guest-list check lives *inside* that function
rather than in each router, so a newly added provider cannot accidentally skip it — which is
exactly what happened before, when enforcement sat inline in the Google branch and the QA
path never checked at all.

Two columns express access, and they must stay in step:

* ``invites.revoked_at`` is authoritative for *signing in* — see :func:`ensure_allowed`.
* ``users.disabled_at`` mirrors it for *live sessions*. ``get_current_user`` 401s on it, so
  revoking bites on the next request instead of whenever a 30-day JWT expires.

:func:`grant` and :func:`revoke` write both. :func:`resolve_login` clears ``disabled_at`` on a
successful sign-in, so re-granting access needs no separate un-disable step.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select

from app.config import Settings
from app.models import AuthIdentity, Invite, User, _utcnow


class AccessDenied(RuntimeError):
    """The email isn't on the guest list, or its invite was revoked."""


def normalize_email(raw: str) -> str:
    """Lowercase + strip. Every email is stored and compared in this form."""
    return raw.strip().lower()


def legacy_sub(provider: str, subject: str) -> str:
    """The value written to the legacy ``users.google_sub`` column.

    Google keeps its bare subject, so existing rows and the unique index are untouched. Every
    other provider gets ``provider:subject``, which is the shape ``app/qa_seed.py`` already
    builds for QA personas — so that module needs no changes. Deriving the value from the
    subject rather than a random id lets the unique index keep catching duplicate identities.
    """
    return subject if provider == "google" else f"{provider}:{subject}"


def ensure_allowed(session: Session, settings: Settings, email: str) -> Invite | None:
    """Raise :class:`AccessDenied` unless ``email`` may sign in.

    Returns the gating :class:`Invite`, or None when the gate is open.

    An empty guest list means *closed*. That inverts the old ALLOWED_EMAILS behaviour, where a
    blank value admitted every verified Google account — so a botched secret update opened the
    app to the internet rather than locking it. ``allow_open_signup`` is the deliberate,
    explicit way to open signup instead.
    """
    if settings.allow_open_signup:
        return None
    invite = session.exec(select(Invite).where(Invite.email == email)).first()
    if invite is None or invite.revoked_at is not None:
        raise AccessDenied("This account isn't allowed to use this app.")
    return invite


def resolve_login(
    session: Session,
    settings: Settings,
    *,
    provider: str,
    subject: str,
    email: str,
    name: str | None = None,
    picture: str | None = None,
) -> tuple[User, bool]:
    """Turn a verified provider assertion into a :class:`User`. Returns ``(user, is_new)``.

    Raises :class:`AccessDenied` if the email isn't invited.

    Linking rule: an identity we haven't seen falls back to matching a User by email, so
    signing in by magic link with the same address already used for Google lands on the
    existing account instead of creating a second one. That is only safe because every
    provider wired up here proves control of the address — Google checks ``email_verified``
    (``app/auth.py``) and a magic link is delivered to the inbox itself. **A future provider
    that asserts an unverified email would turn this into an account-takeover path**, so check
    before adding one; Apple's private-relay addresses (ct-cr.7) need thought in particular.

    Profile fields are only overwritten when the provider actually supplied them, so signing
    in by email doesn't wipe the name and avatar Google filled in.
    """
    email = normalize_email(email)
    invite = ensure_allowed(session, settings, email)

    identity = session.exec(
        select(AuthIdentity)
        .where(AuthIdentity.provider == provider)
        .where(AuthIdentity.provider_subject == subject)
    ).first()

    user = session.get(User, identity.user_id) if identity is not None else None
    if user is None:
        user = session.exec(select(User).where(User.email == email)).first()

    is_new = user is None
    if user is None:
        user = User(google_sub=legacy_sub(provider, subject), email=email)

    user.email = email
    if name is not None:
        user.name = name
    if picture is not None:
        user.picture = picture
    user.disabled_at = None
    session.add(user)
    session.commit()
    session.refresh(user)

    if identity is None:
        identity = AuthIdentity(user_id=user.id, provider=provider, provider_subject=subject)
    identity.user_id = user.id
    identity.email = email
    identity.last_login_at = _utcnow()
    session.add(identity)

    if invite is not None and invite.accepted_at is None:
        invite.accepted_at = _utcnow()
        session.add(invite)

    session.commit()
    session.refresh(user)
    return user, is_new


def backfill_identities(session: Session) -> int:
    """Give every pre-existing User an :class:`AuthIdentity`. Idempotent; returns rows added.

    The one-time migration off ``users.google_sub``, run at startup. A ``qa:`` prefix maps to
    provider ``qa``; anything else was a Google subject. :func:`resolve_login` also creates a
    missing identity lazily, so a user inserted straight into the DB after boot (as
    ``scripts/seed_qa_data.py`` does) self-heals on next sign-in rather than waiting for a
    restart.
    """
    linked = set(session.exec(select(AuthIdentity.user_id)).all())
    created = 0
    for user in session.exec(select(User)).all():
        if user.id in linked:
            continue
        sub = user.google_sub or ""
        provider, subject = ("qa", sub[3:]) if sub.startswith("qa:") else ("google", sub)
        session.add(
            AuthIdentity(
                user_id=user.id, provider=provider, provider_subject=subject, email=user.email
            )
        )
        created += 1
    if created:
        session.commit()
    return created


def seed_invites(session: Session, settings: Settings) -> int:
    """Populate ``invites`` at startup. Idempotent; returns rows added.

    Two sources, and the second one matters more than it looks:

    1. ALLOWED_EMAILS + OWNER_EMAIL, so existing config keeps working and a fresh DB has a way
       in.
    2. **Every email that already has an account.** Having a User row is proof the address
       could sign in before the guest list existed, and switching to fail-closed must not
       retroactively lock those people out. Without this, deploying would evict any user whose
       address wasn't also named in ALLOWED_EMAILS — which is most of them, since a blank
       ALLOWED_EMAILS used to mean "allow everyone".

    Existing invite rows are left strictly alone, so **a revoked invite is never resurrected**
    — by either source. That would otherwise happen on every restart for anyone still named in
    the env var, or still holding an account. Revoking is what cuts access; tidying up
    ALLOWED_EMAILS afterwards is optional.
    """
    seeded = set(settings.allowed_email_set)
    if settings.owner_email:
        seeded.add(normalize_email(settings.owner_email))
    grandfathered = {normalize_email(e) for e in session.exec(select(User.email)).all() if e}

    already_invited = set(session.exec(select(Invite.email)).all())
    created = 0
    for email in sorted((seeded | grandfathered) - already_invited):
        session.add(Invite(email=email, invited_by="seed" if email in seeded else "existing"))
        created += 1
    if created:
        session.commit()
    return created


def _set_disabled(session: Session, email: str, when: datetime | None) -> None:
    """Mirror an invite's revoked state onto every User row with that email."""
    for user in session.exec(select(User).where(User.email == email)).all():
        user.disabled_at = when
        session.add(user)


def grant(
    session: Session, email: str, *, invited_by: str | None = None, note: str | None = None
) -> Invite:
    """Add an invite, or lift the revocation on an existing one. Also re-enables live sessions.

    Doubles as "restore" — re-granting a revoked email is the same operation as inviting it.
    """
    email = normalize_email(email)
    invite = session.exec(select(Invite).where(Invite.email == email)).first()
    if invite is None:
        invite = Invite(email=email, invited_by=invited_by, note=note)
    else:
        invite.revoked_at = None
        if note is not None:
            invite.note = note
    session.add(invite)
    _set_disabled(session, email, None)
    session.commit()
    session.refresh(invite)
    return invite


def revoke(session: Session, email: str) -> Invite | None:
    """Revoke an invite and disable any signed-in session for it. None if never invited."""
    email = normalize_email(email)
    invite = session.exec(select(Invite).where(Invite.email == email)).first()
    if invite is None:
        return None
    now = _utcnow()
    invite.revoked_at = now
    session.add(invite)
    _set_disabled(session, email, now)
    session.commit()
    session.refresh(invite)
    return invite
