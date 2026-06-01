"""Test fixtures.

Point the app at a throwaway SQLite DB + photos dir BEFORE importing the app, so the
real data/ directory is never touched. Settings reads these from the environment.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="ct-test-"))
os.environ["DB_PATH"] = str(_tmp / "test.db")
os.environ["PHOTOS_DIR"] = str(_tmp / "photos")
os.environ["OPENROUTER_API_KEY"] = "test-key"  # presence checked by the wrapper
# Auth config for tests. Google token verification itself is monkeypatched in test_auth.
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id"
os.environ["JWT_SECRET"] = "test-secret-at-least-32-bytes-long-xyz"
os.environ["ALLOWED_EMAILS"] = "owner@example.com,partner@example.com"
os.environ["OWNER_EMAIL"] = "owner@example.com"

import io  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db import engine, init_db  # noqa: E402
from app.deps import get_current_user  # noqa: E402
from app.main import app  # noqa: E402
from app.models import BodyMetric, ExerciseEntry, FoodEntry, Targets, User  # noqa: E402
from sqlmodel import Session, delete  # noqa: E402

# Stand-in signed-in user for the data-CRUD tests, injected via dependency override so
# those tests don't each perform the Google login dance. Auth-flow tests use anon_client.
TEST_USER = User(id=1, google_sub="test-sub-1", email="owner@example.com", name="Owner")


@pytest.fixture(autouse=True)
def clean_db():
    """Give each test empty tables so created rows don't leak between tests."""
    init_db()
    with Session(engine) as s:
        s.exec(delete(FoodEntry))
        s.exec(delete(Targets))  # single targets row would otherwise leak across tests
        s.exec(delete(BodyMetric))
        s.exec(delete(ExerciseEntry))
        s.exec(delete(User))
        s.commit()
    yield


@pytest.fixture
def client() -> TestClient:
    """Authenticated client: get_current_user is overridden to TEST_USER."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client() -> TestClient:
    """Unauthenticated client exercising the real cookie/JWT path (for auth tests)."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_jpeg() -> bytes:
    """A tiny valid JPEG to exercise the upload/normalize path."""
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (180, 120, 60)).save(buf, format="JPEG")
    return buf.getvalue()
