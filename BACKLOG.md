# Calorie Tracker — Feature Backlog

## Context

The app is a single-user, publicly-accessible calorie tracker: FastAPI + SQLModel + SQLite on the
backend (custom additive migrations in [app/db.py](app/db.py), no Alembic), OpenRouter LLM estimation
with optional USDA grounding ([app/openrouter.py](app/openrouter.py), [app/usda.py](app/usda.py)), and a
React 19 + Vite + React Query SPA with plain-CSS dark theme and a tab-based shell ([web/src/App.tsx](web/src/App.tsx)).
Current features: photo/text → AI estimate → reviewable entry, entries CRUD + day summary, meal
grouping, and daily calorie + macro-split targets.

This backlog turns the initial five feature ideas (+ "anything else") into sequenced, executable work.
Two architectural facts make several items cheap:

- **Multi-user was anticipated.** Every table already carries a nullable `user_id` (always `NULL` today)
  and there's an auth placeholder in [app/deps.py](app/deps.py) with code comments describing the exact
  scoping pattern. Auth is wiring, not a rewrite.
- **The text-estimation pattern is reusable.** `analyze_food_text` + the USDA tool loop in
  [app/openrouter.py](app/openrouter.py) is a clean template for free-text exercise estimation (M4).

**Decisions:** quick wins first → auth → health metrics/charts → activity; auth via **Google OAuth +
email allowlist** (closed access, no public signup); expenditure shown as **net = intake − expenditure
with a gross/net toggle**; charts via **Recharts**.

---

## Milestone 1 — Quick wins (ship first)

### 1.1 + 1.2 Extend the nutrition schema: numeric grams + fiber/sugar/sodium

Do these together so there's **one** schema/migration change, not two. Calorie density needs a numeric
weight (today `serving_size` is free text like `"1 bowl (~300g)"` — no usable grams). Fiber & sugar
directly support the satiety/density thesis and USDA already returns them.

- **Backend:**
  - Add `weight_g`, `fiber_g`, `sugar_g`, `sodium_mg` (all optional float) to the analysis JSON schema +
    `FoodItem`/`AnalysisResult` ([app/schemas.py](app/schemas.py) ~40–79) and to `FoodEntry`
    ([app/models.py](app/models.py)) + `EntryCreate`/`EntryRead`/`EntryUpdate`.
  - Migrate via the existing additive helper `_migrate_add_columns` in [app/db.py](app/db.py) (already
    proven by [tests/test_migration.py](tests/test_migration.py)).
  - Ask the model for total grams + fiber/sugar in the system prompts ([app/openrouter.py](app/openrouter.py)
    lines ~20–37); pull USDA fiber (`291`), total sugars (`269`), sodium (`307`) in [app/usda.py](app/usda.py).
- **Frontend:** mirror the new optional fields in `Entry`/`EntryCreate` ([web/src/types/index.ts](web/src/types/index.ts));
  add editable inputs (reuse [MacroInput](web/src/components/MacroInput.tsx)) in
  [EstimateCard](web/src/components/EstimateCard.tsx) and [EntryRow](web/src/components/EntryRow.tsx).
- **Effort:** S–M.

### 1.3 Calorie-density indicator

- New util `web/src/lib/density.ts`: `calorieDensity(calories, weight_g)` → kcal/100g + band. Convert the
  per-pound scale to per-100g (1 lb = 453.6 g): **very low <88**, **low 88–176**, **medium 176–397**,
  **very high >397** kcal/100g (i.e. 400 / 800 / 1800 kcal/lb cutoffs).
- Color-coded badge on [EntryRow](web/src/components/EntryRow.tsx) and [EstimateCard](web/src/components/EstimateCard.tsx)
  (reuse the confidence-badge color pattern); show day-average density in [EnergySummary](web/src/components/EnergySummary.tsx).
- Depends on 1.1 (`weight_g`). **Effort:** S.

### 1.4 Recent / favorite foods + quick re-log ⭐ biggest everyday gap

Today *every* log hits the AI (latency, token cost, variability). Let users re-log known foods instantly.

- **v1 (recent):** backend `GET /api/foods/recent` returns distinct recent `FoodEntry` by `food_name`;
  CapturePage gets a searchable list that prefills an `EstimateCard` draft with **no AI call** (reuse
  `draftFromAnalysis` in [CapturePage](web/src/pages/CapturePage.tsx)).
- **v2 (saved foods):** new `SavedFood` table + `/api/foods` CRUD, new `web/src/api/foods.ts`, a ⭐ toggle.
- **v3 (saved meals/combos):** stretch.
- **Effort:** M. High UX + cost win.

---

## Milestone 2 — Multi-user via Google OAuth + allowlist

Closed access for the two near-term users on one deployment; Google handles passwords, an email allowlist
keeps it private without building signup. Doing this **before** the data-heavy milestones avoids a larger
backfill later (a one-line `UPDATE` assigns today's `NULL`-owned rows to the owner account).

- **Backend:**
  - New `User` model (`id`, `google_sub` unique, `email`, `name`, `picture`).
  - Config additions ([app/config.py](app/config.py)): `google_client_id`, `allowed_emails` (CSV allowlist),
    `jwt_secret`, token TTL. Deps: `google-auth` (verify ID token) + `PyJWT`.
  - `POST /api/auth/google` (verify Google ID token → check allowlist → upsert `User` → issue app JWT in an
    httpOnly cookie), `GET /api/auth/me`, `POST /api/auth/logout`. Implement the real `get_current_user` in
    [app/deps.py](app/deps.py) (replacing the placeholder).
  - **Scope every query by `user_id`** in [entries.py](app/routers/entries.py), [targets.py](app/routers/targets.py),
    and all new routers — the pattern is already documented in code comments. Backfill existing rows.
- **Frontend:** Google Identity Services button + a login gate around [App.tsx](web/src/App.tsx); send
  credentials and handle `401 → login` in [web/src/api/client.ts](web/src/api/client.ts); `VITE_GOOGLE_CLIENT_ID`.
- **Effort:** M–L (foundational).

---

## Milestone 3 — Health metrics & insights

### 3.1 Weight & body-fat logging + goals

- New `BodyMetric` model (`user_id`, `date`, `weight_kg`, `body_fat_pct`, `note`) — upsert one row per day.
  Router `/api/metrics` (POST / GET-range / PATCH / DELETE).
- Goals: add `goal_weight_kg`, `goal_body_fat_pct`, `weekly_rate` to the `Targets` model (additive migration).
- Store canonical **kg**; add a kg/lb display toggle. Logging UI on a new Progress page (or Goals page),
  reusing the MacroInput field pattern. **Effort:** M.

### 3.2 Progress / Trends view — Recharts

- Add `recharts`; add a `trends` tab to the `Tab` union + tab bar in [App.tsx](web/src/App.tsx).
- Backend aggregation endpoint `GET /api/entries/range?from&to` → per-day totals (reuse the day-summary
  logic so the chart isn't pulling every entry); metrics range from 3.1.
- Charts: **(a)** stacked bar — daily calories split by macro contribution (`protein*4`, `carbs*4`, `fat*9`,
  reuse `ATWATER` in [web/src/lib/targets.ts](web/src/lib/targets.ts)) vs a target reference line;
  **(b)** calorie/macro trend line with 7-day moving average; **(c)** weight + body-fat over time with an
  EMA-smoothed trend (scale weight is noisy). Reuse `sumTotals` and the date utils in [web/src/lib/](web/src/lib/).
- **Effort:** M–L.

### 3.3 TDEE/BMR + adaptive target recommender (stretch, killer)

- Add `height_cm`, `age`/`birth_year`, `sex` to the user profile → Mifflin-St Jeor BMR × activity factor = TDEE;
  recommend a calorie target for a chosen weekly rate instead of guessing 2000.
- Adaptive (MacroFactor-style): infer real TDEE from the trailing weight trend vs logged intake and auto-suggest
  target adjustments — a genuine differentiator. Depends on 3.1 + 3.2. **Effort:** M (basic) → L (adaptive).

---

## Milestone 4 — Activity & expenditure

- **Model:** daily `Expenditure` row (`user_id`, `date`, `steps`, `steps_kcal`, `exercise_kcal`, `note`).
- **4.1 Steps → calories:** `kcal ≈ steps × weight_kg × k`. Needs latest `BodyMetric` weight (depends on 3.1).
- **4.2 Exercise logging:**
  - Manual: kcal + description.
  - **Free-text AI estimate** ("30 min easy lifting"): add `analyze_activity_text` + `POST /api/analyze/activity`,
    mirroring `analyze_food_text` in [app/openrouter.py](app/openrouter.py) exactly (system prompt with MET
    tables → kcal + duration). High-reuse.
  - Double-count guard (the "fancy" idea): optionally subtract step-derived kcal overlapping a logged workout —
    mark advanced; v1 leaves it to the user.
- **Net-calorie integration:** [EnergySummary](web/src/components/EnergySummary.tsx) gains a
  gross/net toggle — `remaining = target − (intake − expenditure)`; thread per-day expenditure into
  [LogPage](web/src/pages/LogPage.tsx). **Effort:** M–L.

---

## Backlog — additional ideas, unsequenced

- **Barcode scanning** ⭐ — PWA camera + `@zxing/browser` → barcode → **Open Food Facts** (free, no key) →
  exact packaged-food macros prefilled into a draft. Best accuracy/speed for packaged foods. (M)
- **Data export** — `GET /api/export` (CSV/JSON of entries + metrics). Cheap, valuable for a health log. (S)
- **Water tracking** — per-day counter. (S)
- **Weekly view + log search/filter** — beyond the current day-by-day nav. (S–M)
- **Streaks / adherence** — logging streak + on-target days. (S)
- **Offline robustness** — audit the installed `vite-plugin-pwa`: cache the shell, queue entry writes offline. (M)
- **Photo history gallery** — photos are already stored under `/data/photos`. (S)
- **Timezone note** — timestamps are naive local time; fine single-device, revisit if used across devices.

---

## Refactor checkpoints

The foundation is healthy and every milestone is additive, so the guidance is **let it rip, with one
deliberate refactor at auth** — not broad stop-and-refactor passes.

- **Milestone 2 (auth) — refactor here.** Land the real `current_user` dependency
  ([app/deps.py](app/deps.py)) plus a single shared per-user scoping helper, so
  `where(user_id == current_user.id)` lives in one place instead of being copy-pasted into every
  endpoint and retrofitted later. Highest-leverage cleanup; small.
- **Milestone 3 (optional).** Reassess navigation only if it hurts: tab-state in [App.tsx](web/src/App.tsx)
  is fine to ~4–5 tabs; when adding Trends + a Body/Progress area behind the auth gate, decide whether to
  introduce React Router (deep links, browser back). Not mandatory.
- **Opportunistic (not a stop):** delete the unused `DailyTotals`/`EntryList` components; have the 3.2
  range endpoint reuse the existing day-summary logic rather than duplicating it.

---

## Dependency summary

```text
1.1/1.2 (nutrition fields) ──> 1.3 (density)
2 (auth) ── foundational; do before 3/4 to avoid backfill
3.1 (weight) ──> 3.2 charts(weight), 3.3 TDEE, 4.1 steps→kcal
3.2 (range endpoint + Recharts) ──> 3.3
```

---

## Verification (per feature)

- **Backend:** `pytest` (suite + [tests/conftest.py](tests/conftest.py) exist). Per feature, mirror the existing
  tests — [test_entries.py](tests/test_entries.py) (CRUD/roundtrip), [test_targets.py](tests/test_targets.py)
  (validation/upsert), [test_analyze_text.py](tests/test_analyze_text.py) (LLM tool-loop), and add a
  [test_migration.py](tests/test_migration.py)-style test for every new column (legacy table → migrate → assert
  column + idempotency).
- **Frontend / e2e:** run backend (`uvicorn`) + `vite dev` and walk each flow — log via density/fiber fields,
  quick re-log a recent food (confirm no AI call), Google login as a second account (confirm data isolation),
  add weight and view trend charts, log steps + a free-text workout and toggle gross/net.
- Each milestone is independently shippable; land 1.1+1.2 first (single migration) so 1.3 has its grams field.
