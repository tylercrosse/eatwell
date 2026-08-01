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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
