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

import io  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db import engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import FoodEntry  # noqa: E402
from sqlmodel import Session, delete  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    """Give each test an empty table so created rows don't leak between tests."""
    init_db()
    with Session(engine) as s:
        s.exec(delete(FoodEntry))
        s.commit()
    yield


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_jpeg() -> bytes:
    """A tiny valid JPEG to exercise the upload/normalize path."""
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (180, 120, 60)).save(buf, format="JPEG")
    return buf.getvalue()
