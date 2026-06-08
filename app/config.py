"""Application configuration loaded from environment / .env.

A single ``Settings`` instance is created at import time and injected everywhere
via the ``get_settings`` dependency, so nothing else reads ``os.environ`` directly.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "google/gemini-3-flash-preview"
    openrouter_timeout: float = 60.0
    app_title: str = "Calorie Tracker"
    app_referer: str = "http://localhost:5173"

    # USDA FoodData Central (grounds text estimates). Empty key -> pure-LLM fallback.
    usda_api_key: str = ""
    usda_base_url: str = "https://api.nal.usda.gov/fdc/v1"
    usda_search_page_size: int = 5

    # Open Food Facts — barcode lookup fallback (worldwide, no key). USDA's Branded
    # dataset is tried first (US-authoritative); OFF covers international items + US gaps.
    off_base_url: str = "https://world.openfoodfacts.org"
    # OFF asks API clients to send a descriptive User-Agent identifying the app.
    off_user_agent: str = "CalorieTracker/1.0 (barcode lookup)"

    # Storage
    db_path: Path = Path("data/app.db")
    photos_dir: Path = Path("data/photos")

    # Serving
    serve_static: bool = False
    static_dir: Path = Path("web/dist")
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Image processing limits
    max_upload_bytes: int = 15 * 1024 * 1024  # 15 MB
    max_image_dimension: int = 1024  # longest side sent to the model (token savings)

    # Auth (Google sign-in). Empty client id -> login can't succeed (verification fails).
    google_client_id: str = ""
    # Comma-separated allowlist; only these emails may sign in. Empty -> allow any
    # Google account that verifies (open — set this in any shared deployment).
    allowed_emails: str = ""
    # HMAC secret for our own session JWTs. MUST be set to a long random value in prod.
    jwt_secret: str = "dev-insecure-change-me"
    jwt_ttl_seconds: int = 60 * 60 * 24 * 30  # 30 days
    # Email whose first login adopts pre-auth (user_id IS NULL) rows. Empty -> no backfill.
    owner_email: str = ""
    # Send the session cookie only over HTTPS. Keep false for local http dev.
    cookie_secure: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.allowed_emails.split(",") if e.strip()}

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.db_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
