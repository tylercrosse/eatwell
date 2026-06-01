"""Authentication primitives: verify Google ID tokens, mint/read our own session JWTs.

Flow: the browser signs in with Google Identity Services and sends us the resulting ID
token (``credential``). We verify it against Google, then issue our OWN short-lived JWT
stored in an httpOnly cookie — so every subsequent request is authenticated without
re-contacting Google. Kept framework-agnostic; FastAPI wiring lives in deps.py / routers.
"""

from __future__ import annotations

import time

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import Settings

# Name of the httpOnly cookie carrying our session JWT.
SESSION_COOKIE = "ct_session"

_JWT_ALGO = "HS256"


class AuthError(RuntimeError):
    """Token verification failed, or auth is not configured."""


def verify_google_token(credential: str, settings: Settings) -> dict:
    """Verify a Google ID token; return its claims (sub, email, name, picture, ...).

    Raises ``AuthError`` if unconfigured, the token is invalid/expired, or the email is
    unverified. Network call to Google's certs is cached by the library.
    """
    if not settings.google_client_id:
        raise AuthError("GOOGLE_CLIENT_ID is not configured.")
    try:
        claims = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.google_client_id
        )
    except ValueError as exc:  # bad signature / audience / expiry
        raise AuthError(f"Invalid Google token: {exc}") from exc
    if not claims.get("email_verified", False):
        raise AuthError("Google account email is not verified.")
    return claims


def create_session_token(user_id: int, settings: Settings) -> str:
    """Mint a signed session JWT for ``user_id``, expiring after the configured TTL."""
    now = int(time.time())
    payload = {"sub": str(user_id), "iat": now, "exp": now + settings.jwt_ttl_seconds}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_JWT_ALGO)


def decode_session_token(token: str, settings: Settings) -> int:
    """Validate a session JWT and return its user id. Raises ``AuthError`` if invalid."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_JWT_ALGO])
    except jwt.PyJWTError as exc:  # expired / tampered / malformed
        raise AuthError(f"Invalid session: {exc}") from exc
    try:
        return int(payload["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise AuthError("Malformed session token.") from exc
