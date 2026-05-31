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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.db_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
