# AGENTS GUIDANCE

Guidance for AI coding agents working in this repository.

## Read First

Start with these files before making non-trivial changes:

- `README.md` - project architecture, setup, auth, deployment, and backend/API notes.
- `web/README.md` - frontend commands, architecture, and UI conventions.
- `docs/BACKLOG.md` - implementation roadmap and feature context.
- `docs/COMMERCIAL_READINESS.md` - launch, monetization, privacy, deployment, domain,
  and App Store readiness work.
- `docs/PRODUCT_OPPORTUNITIES.md` - product ideas, differentiators, and future bets.

## Project Shape

This is a calorie-tracking app with:

- FastAPI backend in `app/`.
- SQLModel + SQLite persistence, with additive migration helpers in `app/db.py`.
- Vite + React + TypeScript PWA in `web/`.
- Backend tests in `tests/`.
- Fly.io single-service deployment via `Dockerfile` and `fly.toml`.

The backend owns auth, persistence, photo normalization, barcode lookup, USDA lookup,
and OpenRouter-backed AI estimation. The frontend is a mobile-first PWA that talks to
the backend over `/api`.

## Current Product Assumptions

- The app is still personal/beta-oriented, not public App Store ready.
- Auth is Google sign-in with an email allowlist.
- User data is scoped by `user_id`; use the shared dependency/query helpers instead of
  hand-rolling ownership checks.
- The current web UI is optimized for mobile/PWA use. Wider desktop/tablet layout is
  planned but not fully implemented.
- Docs in `docs/` are planning specs; keep them updated when product direction changes.

## Working Rules

- Do not overwrite or revert user changes. This repo often has a dirty worktree.
- Prefer small, scoped changes that match existing patterns.
- Use `rg`/`rg --files` for search.
- Use `apply_patch` for manual file edits.
- Do not commit secrets. `.env` is local only.
- Keep backend behavior user-scoped and testable.
- Keep frontend changes responsive, accessible, and consistent with existing CSS tokens.
- Avoid adding new dependencies unless they clearly reduce complexity or unlock a planned
  capability.

## Backend Conventions

- Add routes under `app/routers/` and include them in `app/main.py`.
- Use `Depends(get_current_user)` for authenticated routes.
- Use `user_query(...)` and `get_owned(...)` from `app/deps.py` for user-scoped reads and
  ownership checks.
- Keep request/response models in `app/schemas.py`.
- Keep persistent models in `app/models.py`.
- For SQLite schema changes, follow the additive pattern in `app/db.py` and add migration
  tests in `tests/test_migration.py`.
- Wrap third-party failures in domain-specific errors and surface appropriate HTTP status
  codes from routers.
- Do not store raw secrets, raw model prompts, or sensitive user content in telemetry.

## Frontend Conventions

- The app uses React Query for server state and plain CSS in `web/src/index.css`.
- API helpers live in `web/src/api/`; shared types live in `web/src/types/index.ts`.
- Shared product logic lives under `web/src/lib/`.
- Keep generated UI practical and task-oriented. This is an operational tracker, not a
  marketing dashboard.
- Preserve mobile ergonomics when adding desktop/tablet improvements.
- Respect existing theme tokens and avoid hard-coded colors unless there is a clear
  local precedent.
- For substantial UI changes, verify on mobile and desktop widths.

## Common Commands

Backend:

```bash
uv run pytest
uv run ruff check app tests
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd web && npm run build
cd web && npm run lint
cd web && npm run test
cd web && npm run dev
```

Integrated local build:

```bash
cd web && npm run build && cd ..
SERVE_STATIC=true uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verification Expectations

- Backend-only changes: run `uv run pytest` and usually `uv run ruff check app tests`.
- Frontend-only changes: run `cd web && npm run build`; run lint/tests when relevant.
- Cross-stack changes: run backend tests and frontend build.
- Docs-only changes: no test run required, but check links/filenames and keep docs
  consistent with files under `docs/`.

## Documentation Routing

- Implementation roadmap: `docs/BACKLOG.md`.
- Commercial/App Store readiness: `docs/COMMERCIAL_READINESS.md`.
- Product maturity/showcase priorities: `docs/PRODUCT_MATURITY_ROADMAP.md`.
- Product strategy/opportunities: `docs/PRODUCT_OPPORTUNITIES.md`.
- Setup/deploy/how to run: `README.md`.
- Frontend-specific notes: `web/README.md`.

When adding a major feature, update the relevant planning doc if the work changes
priority, scope, or product direction.
