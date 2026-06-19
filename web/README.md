# Calorie Tracker Frontend

Vite + React + TypeScript PWA for the calorie tracker. The frontend is intentionally thin:
it owns capture/review UI, local presentation state, React Query caches, chart rendering,
themes, and PWA behavior while the FastAPI backend remains the source of truth.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run screenshots
npm run preview
```

Common local development setup from the repo root:

```bash
# terminal 1
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# terminal 2
cd web && npm run dev
```

Vite proxies `/api` and `/photos` to `http://localhost:8000`, so local browser calls stay
same-origin.

## Browser QA

Playwright e2e tests use the local QA auth endpoint and reseed the QA personas before each
run. The Playwright config starts FastAPI on `127.0.0.1:8010` with QA auth enabled and Vite
on `127.0.0.1:5175`, so it does not collide with the normal dev servers.

```bash
cd web && npm run test:e2e
cd web && npm run screenshots
```

Screenshots are written under `web/screenshots/` for `qa-loss`, `qa-gain`, and
`qa-sporadic` using an iPhone-sized `430×932` viewport. The script clears old screenshots
first, so rerunning it keeps the showcase captures current. Set `E2E_SEED_END_DATE=YYYY-MM-DD`
when you need deterministic dated screenshots.

## Structure

```text
src/App.tsx           app shell, auth gate, tab navigation
src/api/              typed API helpers
src/components/       reusable UI components
src/lib/              product math, formatting, prefs, themes
src/pages/            Log, Trends, Guide, Goals, Capture flows
src/types/            backend response/request mirrors
src/index.css         global styles and theme tokens
```

## Environment

Copy `web/.env.example` to `web/.env.local` when local auth is needed.

- `VITE_GOOGLE_CLIENT_ID` is build-time config for Google Identity Services.
- `VITE_API_BASE_URL` defaults to `/api`; only override it when the API is on a separate
  origin.

## Frontend Conventions

- Use React Query for server state and cache invalidation.
- Keep API shapes in snake_case to match the backend and avoid mapping layers.
- Keep shared calculations in `src/lib/` and cover meaningful product math with Vitest.
- Use existing CSS tokens and theme variables instead of hard-coded colors.
- Preserve mobile/PWA ergonomics; desktop/tablet responsiveness is a planned commercial
  readiness item, not a reason to break the current phone layout.
- Keep capture and review flows constrained and fast; logging speed is a core product bet.
- When adding AI-powered UI, make cost/latency/error states explicit and avoid automatic
  calls without user intent.

## Verification

For frontend changes, run:

```bash
npm run build
npm run lint
npm run test:e2e
```

Run `npm run test` when changing code under `src/lib/` or anything with existing Vitest
coverage.

For visual or layout changes, also manually check at phone and desktop widths. Important
surfaces: Log, capture/review modal, Trends charts, Guide/menu scanner, Goals, Settings,
and login.

## Planning Docs

- Agent guidance: [`../AGENTS.md`](../AGENTS.md)
- Implementation roadmap: [`../docs/BACKLOG.md`](../docs/BACKLOG.md)
- Commercial readiness: [`../docs/COMMERCIAL_READINESS.md`](../docs/COMMERCIAL_READINESS.md)
- Product opportunities: [`../docs/PRODUCT_OPPORTUNITIES.md`](../docs/PRODUCT_OPPORTUNITIES.md)
