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
from app.auth import SESSION_COOKIE
from app.config import Settings
from app.deps import get_current_user, get_session, get_settings
from app.models import FoodEntry, Targets, User

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    credential: str  # the Google ID token from Google Identity Services


class QaLoginRequest(BaseModel):
    account: str
    secret: str


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


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
