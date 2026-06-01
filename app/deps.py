"""Shared FastAPI dependencies.

Centralized so routers depend on these rather than importing engine/settings directly.
``get_current_user`` reads the session cookie and resolves the row owner; ``user_query``
is the single place per-user scoping lives, so no router hand-writes the user_id filter.
"""

from __future__ import annotations

from typing import TypeVar

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session, SQLModel, select
from sqlmodel.sql.expression import SelectOfScalar

from app.auth import SESSION_COOKIE, AuthError, decode_session_token
from app.config import Settings, get_settings  # noqa: F401  (re-exported for routers)
from app.db import get_session  # noqa: F401
from app.models import User

_Model = TypeVar("_Model", bound=SQLModel)


def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    """Resolve the signed-in user from the session cookie, or raise 401."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    try:
        user_id = decode_session_token(token, settings)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists."
        )
    return user


def user_query(model: type[_Model], user: User) -> SelectOfScalar[_Model]:
    """A SELECT over ``model`` scoped to ``user``'s rows. Chain further .where()s as needed.

    Every per-user query goes through here, so the user_id filter is defined once.
    """
    return select(model).where(model.user_id == user.id)


def get_owned(
    session: Session, model: type[_Model], obj_id: int, user: User, *, what: str = "Item"
) -> _Model:
    """Fetch a row by id, raising 404 if it's missing OR owned by another user.

    The single ownership-check primitive used by the id-addressed CRUD routes.
    """
    obj = session.get(model, obj_id)
    if obj is None or obj.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found.")
    return obj
