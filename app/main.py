"""FastAPI application entrypoint.

Mount order matters: /api and /photos are registered before the optional catch-all
static mount at /, so API routes always win. Flip SERVE_STATIC to split the frontend
into its own service later — no route changes needed.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import analyze, auth, entries, exercise, foods, metrics, targets, trends

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_title, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,  # send/receive the session cookie cross-origin (specific origins required)
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
app.include_router(exercise.router, prefix="/api")
app.include_router(foods.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(targets.router, prefix="/api")
app.include_router(trends.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Uploaded photos (served as files, not a route).
settings.photos_dir.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=settings.photos_dir), name="photos")

# Optional: serve the built PWA from the same process (single-service deploy).
if settings.serve_static and settings.static_dir.exists():
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="web")
