"""Auth endpoints: Google sign-in, local QA sign-in, current user, sign-out.

Each route's only job is to *verify* a provider's assertion. Turning that into an account is
``app.accounts.resolve_login``, which is also where the guest-list check lives — so no route
can admit someone by forgetting to call it. The first login of the configured owner adopts
any pre-auth rows (user_id IS NULL) so data logged before auth isn't orphaned.
"""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app import accounts
from app import auth as auth_lib
from app import magic_link, mailer
from app.auth import SESSION_COOKIE
from app.config import Settings
from app.deps import get_current_user, get_session, get_settings
from app.models import FoodEntry, Targets, User

router = APIRouter(prefix="/auth", tags=["auth"])


def _looks_like_email(value: str) -> bool:
    """A deliberately loose check: exactly one @, something either side, a dot in the domain.

    Hand-rolled because pydantic's EmailStr would pull in the ``email-validator`` package for
    one field. Delivery is the real validator — an address that doesn't exist just never
    receives anything.
    """
    local, sep, domain = value.partition("@")
    return bool(sep and local and domain and "." in domain and " " not in value)


class GoogleLoginRequest(BaseModel):
    credential: str  # the Google ID token from Google Identity Services


class QaLoginRequest(BaseModel):
    account: str
    secret: str


class EmailLoginRequest(BaseModel):
    email: str


class EmailVerifyRequest(BaseModel):
    """Either ``token`` (from the emailed link) or ``email`` + ``code`` (typed into the app)."""

    token: str | None = None
    email: str | None = None
    code: str | None = None


class EmailRequestAccepted(BaseModel):
    """Deliberately constant — see ``request_email_login`` on why it never reports the truth."""

    sent: bool = True


class UserRead(BaseModel):
    id: int
    email: str
    name: str | None
    picture: str | None


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=settings.jwt_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _is_local_request(request: Request) -> bool:
    return request.url.hostname in {"localhost", "127.0.0.1", "::1"}


def _claim_orphan_rows(session: Session, user: User, settings: Settings) -> None:
    """On the owner's first login, adopt pre-auth (user_id IS NULL) rows.

    No-op unless OWNER_EMAIL is set and matches this user. Small data, so a fetch-and-set
    loop is plenty (no bulk UPDATE needed).
    """
    if not settings.owner_email or user.email.lower() != settings.owner_email.lower():
        return
    for model in (FoodEntry, Targets):
        for row in session.exec(select(model).where(model.user_id.is_(None))).all():
            row.user_id = user.id
            session.add(row)
    session.commit()


@router.post("/google", response_model=UserRead)
def login_google(
    payload: GoogleLoginRequest,
    response: Response,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    try:
        claims = auth_lib.verify_google_token(payload.credential, settings)
    except auth_lib.AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        user, is_new = accounts.resolve_login(
            session,
            settings,
            provider="google",
            subject=claims["sub"],
            email=claims.get("email") or "",
            name=claims.get("name"),
            picture=claims.get("picture"),
        )
    except accounts.AccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if is_new:
        _claim_orphan_rows(session, user, settings)

    _set_session_cookie(response, auth_lib.create_session_token(user.id, settings), settings)
    return user


@router.post("/qa", response_model=UserRead)
def login_qa(
    payload: QaLoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    """Local-only QA login that mints the same session cookie as Google sign-in."""
    if not settings.qa_auth_enabled or not settings.qa_auth_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="QA auth is not available.",
        )
    if not _is_local_request(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="QA auth is only available from localhost.",
        )
    if not secrets.compare_digest(payload.secret, settings.qa_auth_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid QA credentials.",
        )

    account_id = payload.account.strip().lower()
    account = settings.qa_auth_account_map.get(account_id)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid QA credentials.",
        )

    email, name = account
    # Auto-invite so this path goes through the same funnel as everyone else instead of
    # bypassing the guest list. The check still runs, it just can't fail — QA's real gate is
    # localhost + a shared secret, both already verified above, which is stronger than an
    # email list. Deliberately no _claim_orphan_rows here: QA personas must not adopt the
    # owner's pre-auth data.
    accounts.grant(session, email, invited_by="qa")
    user, _ = accounts.resolve_login(
        session,
        settings,
        provider="qa",
        subject=account_id,
        email=email,
        name=name,
    )

    _set_session_cookie(response, auth_lib.create_session_token(user.id, settings), settings)
    return user


@router.post("/email/request", response_model=EmailRequestAccepted)
def request_email_login(
    payload: EmailLoginRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> EmailRequestAccepted:
    """Email a sign-in link + code, if the address is on the guest list.

    Always answers ``{"sent": true}``, whether the address is invited, unknown, or has simply
    asked too often. An honest answer here would be an account-enumeration oracle, and a 429
    for the per-email case would additionally leak that *somebody else* is requesting links for
    that address. Only the per-IP limit returns 429, because that's information about the
    caller's own behaviour.

    A row is recorded for every request, sent or not, so declined attempts still count toward
    the per-IP limit. Mail only actually goes out to invited addresses: without that this
    endpoint is an open relay for mailing sign-in links to strangers, which is both a
    harassment vector and a fast way to ruin sender reputation.

    Known and accepted: sending takes ~1s and declining takes ~5ms, so response time is a weak
    oracle. Closing it needs a queue, which this app doesn't have; fine for a closed beta whose
    guest list isn't secret.
    """
    email = accounts.normalize_email(payload.email)
    if not _looks_like_email(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Enter a valid email address."
        )

    magic_link.purge_expired(session, settings)
    ip = magic_link.client_ip(request.headers, request.client.host if request.client else None,
                              settings)

    if magic_link.over_ip_limit(session, settings, ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in requests. Please try again later.",
        )

    try:
        accounts.ensure_allowed(session, settings, email)
        invited = True
    except accounts.AccessDenied:
        invited = False

    deliver = invited and not magic_link.over_email_limit(session, settings, email)
    raw_token, code = magic_link.mint(
        session, settings, email=email, request_ip=ip, sent=deliver
    )

    if deliver:
        subject, body = magic_link.compose_email(
            settings, link=magic_link.build_link(settings, raw_token), code=code
        )
        try:
            mailer.send_email(to=email, subject=subject, text=body, settings=settings)
        except mailer.EmailNotConfigured as exc:
            # A deploy mistake, and the message names only a setting — safe to return.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
            ) from exc
        except mailer.EmailError as exc:
            # Transport failure. Kept generic: this endpoint needs no auth, so upstream server
            # detail shouldn't be echoed to anonymous callers.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Couldn't send the sign-in email. Please try again.",
            ) from exc

    return EmailRequestAccepted()


@router.post("/email/verify", response_model=UserRead)
def verify_email_login(
    payload: EmailVerifyRequest,
    response: Response,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    """Redeem a magic link or typed code and start a session."""
    try:
        if payload.token:
            row = magic_link.consume_token(session, payload.token)
        elif payload.email and payload.code:
            row = magic_link.consume_code(
                session, settings, email=accounts.normalize_email(payload.email), code=payload.code
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Provide either a sign-in link token or an email and code.",
            )
    except magic_link.TooManyAttempts as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)
        ) from exc
    except magic_link.LinkError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        # Re-checked here, not just at request time: an invite can be revoked in between, and
        # delivery to the inbox is what proves control of the address.
        user, is_new = accounts.resolve_login(
            session,
            settings,
            provider="email",
            subject=row.email,
            email=row.email,
        )
    except accounts.AccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if is_new:
        _claim_orphan_rows(session, user, settings)

    _set_session_cookie(response, auth_lib.create_session_token(user.id, settings), settings)
    return user


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
