"""Shared FastAPI dependencies.

Centralized so routers depend on these rather than importing engine/settings directly,
and so the future ``get_current_user`` auth dependency has an obvious home.
"""

from __future__ import annotations

from app.config import Settings, get_settings  # noqa: F401  (re-exported for routers)
from app.db import get_session  # noqa: F401

# When auth lands:
#   def get_current_user(...) -> User: ...
# and entry routes switch from get_session-only to also Depends(get_current_user),
# scoping every query by user_id.
