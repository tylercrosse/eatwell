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
    # Comma-separated seed for the `invites` table, folded in at startup (app.accounts.
    # seed_invites). The TABLE is the source of truth, not this value: adding someone needs no
    # redeploy, and revoking here does nothing — revoke the invite instead. Kept so existing
    # deploys keep working and a fresh DB has a way in.
    allowed_emails: str = ""
    # Skip the guest list entirely and admit anyone a provider verifies. Off by default, so an
    # empty invites table fails CLOSED (the old allowed_emails behaviour failed open). This is
    # the switch public signup flips (ct-cr.8).
    allow_open_signup: bool = False
    # HMAC secret for our own session JWTs. MUST be set to a long random value in prod.
    jwt_secret: str = "dev-insecure-change-me"
    jwt_ttl_seconds: int = 60 * 60 * 24 * 30  # 30 days
    # The owner account. First login adopts pre-auth (user_id IS NULL) rows; also the only
    # account allowed to invite others. Empty -> no backfill and nobody can invite.
    owner_email: str = ""
    # Send the session cookie only over HTTPS. Keep false for local http dev.
    cookie_secure: bool = False
    # Local-only QA auth for browser/API testing without Google. Disabled by default.
    qa_auth_enabled: bool = False
    qa_auth_secret: str = ""
    qa_auth_accounts: str = (
        "qa-loss|qa-loss@example.test|QA Loss,"
        "qa-gain|qa-gain@example.test|QA Gain,"
        "qa-sporadic|qa-sporadic@example.test|QA Sporadic"
    )

    # Outbound email. "console" prints the message instead of sending it, so the sign-in flow
    # is exercisable with no mailbox; it's the default so a half-configured deploy fails
    # visibly rather than silently dropping mail. "smtp" sends for real.
    email_provider: str = "console"  # "console" | "smtp"
    email_from: str = ""  # must equal smtp_user for Gmail, or Google rewrites the sender
    email_from_name: str = "Calorie Tracker"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True

    # Absolute origin that magic links point at. NEVER derive this from the request's Host
    # header: that's host-header injection, letting an attacker mint a link to a domain they
    # control and harvest the token when the victim clicks it.
    app_base_url: str = "http://localhost:5173"

    # Email sign-in tokens.
    login_token_ttl_seconds: int = 15 * 60
    login_code_max_attempts: int = 5  # wrong typed-code guesses before the token is retired
    login_token_retention_seconds: int = 60 * 60 * 24  # pruned after a day (also expires IPs)
    login_requests_per_email_per_hour: int = 5
    login_requests_per_ip_per_hour: int = 20
    # Header carrying the real client IP behind a proxy (Fly sends Fly-Client-IP). Empty ->
    # use request.client.host. Empty by default so local dev never trusts a spoofable header.
    trusted_client_ip_header: str = ""

    # Shareable invite links. A week is long enough to hand one over and have the person get
    # around to it, short enough that a forgotten link in a chat thread stops working.
    invite_link_ttl_seconds: int = 60 * 60 * 24 * 7
    invite_link_max_uses: int = 20  # ceiling on what a single link may be asked for

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.allowed_emails.split(",") if e.strip()}

    @property
    def qa_auth_account_map(self) -> dict[str, tuple[str, str]]:
        accounts: dict[str, tuple[str, str]] = {}
        for raw in self.qa_auth_accounts.split(","):
            parts = [p.strip() for p in raw.split("|", 2)]
            if len(parts) != 3 or not parts[0] or not parts[1]:
                continue
            account_id, email, name = parts
            accounts[account_id.lower()] = (email.lower(), name)
        return accounts

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.db_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
