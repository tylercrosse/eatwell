# Calorie Tracker — Feature Backlog

## Context

The app is a calorie tracker: FastAPI + SQLModel + SQLite on the backend (custom additive migrations in
[app/db.py](app/db.py), no Alembic), OpenRouter LLM estimation with optional USDA grounding
([app/openrouter.py](app/openrouter.py), [app/usda.py](app/usda.py)), and a React 19 + Vite + React Query
SPA with a plain-CSS dark theme and a tab-based shell ([web/src/App.tsx](web/src/App.tsx)).

Shipped so far: photo/text → AI estimate → reviewable entry; entries CRUD + per-day summary + meal
grouping; extended nutrition (weight/fiber/sugar/sodium) + calorie-density indicator; recent-food quick
re-log; **Google-OAuth multi-user (allowlist, per-user scoping)**; **weight/body-fat logging + body
goals**; **Recharts trends**; calorie/macro targets; editable entry dates.

**Decisions:** quick wins first → auth → health metrics/charts → activity; auth via **Google OAuth +
email allowlist** (closed access, no public signup); expenditure shown as **net = intake − expenditure
with a gross/net toggle**; charts via **Recharts**.

## Status legend

✅ Done · 🚧 Partial · ⏸ Deferred · ⬜ Not started

| Milestone | Status |
| --- | --- |
| M1 Quick wins | ✅ (1.4 saved-foods/meals pending) |
| M2 Multi-user auth | ✅ |
| M3 Health metrics & insights | 🚧 (3.1 + 3.2 done; 3.3 deferred) |
| M4 Activity & expenditure | ⬜ |
| M5 IA & navigation | ⬜ (new) |

---

## Milestone 1 — Quick wins ✅

### 1.1 + 1.2 Extend the nutrition schema: numeric grams + fiber/sugar/sodium — ✅

Did these together as one schema/migration change. `weight_g`, `fiber_g`, `sugar_g`, `sodium_mg` added to
the analysis JSON schema + `FoodEntry` + entry schemas ([app/schemas.py](app/schemas.py),
[app/models.py](app/models.py)); migration via `_migrate_add_columns` ([app/db.py](app/db.py)); prompts +
USDA grounding (fiber `291`, sugars `269`, sodium `307`) updated; editable inputs in
[EstimateCard](web/src/components/EstimateCard.tsx) + [EntryRow](web/src/components/EntryRow.tsx).

### 1.3 Calorie-density indicator — ✅

[web/src/lib/density.ts](web/src/lib/density.ts) (`calorieDensity` + bands), color-coded
[DensityBadge](web/src/components/DensityBadge.tsx) on entries + the estimate card, and a day-level
**calorie-density mix** stacked bar in [EnergySummary](web/src/components/EnergySummary.tsx) (richer than
the originally-planned single "day-average" number).

### 1.4 Recent / favorite foods + quick re-log — 🚧

- **v1 (recent):** ✅ `GET /api/foods/recent` ([app/routers/foods.py](app/routers/foods.py)) + recent-food
  list on the capture flow, prefilling a draft with no AI call.
- **v2 (saved foods):** ⬜ `SavedFood` table + `/api/foods` CRUD + ⭐ toggle.
- **v3 (saved meals/combos):** ⬜ stretch.

---

## Milestone 2 — Multi-user via Google OAuth + allowlist — ✅

`User` model + [app/auth.py](app/auth.py) (Google ID-token verify + session JWT) + auth router
([app/routers/auth.py](app/routers/auth.py): `/auth/google`, `/auth/me`, `/auth/logout`); real
`get_current_user` + shared `user_query` scoping helper ([app/deps.py](app/deps.py)); every data route
scoped by `user_id`; owner-email backfill of pre-auth rows. Frontend login gate + Google Identity Services
button ([web/src/components/LoginPage.tsx](web/src/components/LoginPage.tsx)), `credentials: 'include'`,
build-time `VITE_GOOGLE_CLIENT_ID` (threaded through the [Dockerfile](Dockerfile)).

---

## Milestone 3 — Health metrics & insights — 🚧

### 3.1 Weight & body-fat logging + goals — ✅

`BodyMetric` model (one row/user/day) + `/api/metrics` (POST upsert / GET-range / DELETE,
[app/routers/metrics.py](app/routers/metrics.py)); `goal_weight_kg` / `goal_body_fat_pct` /
`weekly_rate_kg` on `Targets`; canonical kg with a kg/lb toggle ([web/src/lib/units.ts](web/src/lib/units.ts));
body-goals UI on [GoalsPage](web/src/pages/GoalsPage.tsx).

### 3.2 Progress / Trends view — Recharts — ✅

`GET /api/entries/range` (reuses day-summary aggregation); lazy-loaded
[TrendsPage](web/src/pages/TrendsPage.tsx) (recharts code-split) with: stacked calories-by-macro bar + a
7-day moving-average line + target reference line; weight + body-fat lines with an EMA-smoothed weight
trend ([web/src/lib/stats.ts](web/src/lib/stats.ts)); a 7/30/90-day range selector.

### 3.3 TDEE/BMR + adaptive target recommender — ⏸ Deferred (stretch, killer)

Add `height_cm`, `age`/`birth_year`, `sex` to the profile → Mifflin-St Jeor BMR × activity = TDEE; suggest
a calorie target for a chosen weekly rate. Adaptive version infers real TDEE from the trailing weight trend
vs intake. The `weekly_rate_kg` goal (shipped in 3.1) is the hook this builds on. Depends on 3.1 + 3.2.
**Effort:** M (basic) → L (adaptive).

### Shipped beyond the original M3 plan

- **Editable entry dates** — date picker in the create ([EstimateCard](web/src/components/EstimateCard.tsx))
  and edit ([EntryRow](web/src/components/EntryRow.tsx)) flows, so a forgotten meal can be backfilled to a
  past day (`logged_at` date; helpers `dayKeyOf`/`withDayKey` in [date.ts](web/src/lib/date.ts)).
- **Weight/body-fat backfill** — date picker on the Trends quick-log card.
- **Body metric on the Log page** — [MetricCard](web/src/components/MetricCard.tsx) shows a day's
  weight/body-fat like an entry row, with the same edit/delete buttons (only on days that have one).

---

## Milestone 4 — Information architecture & navigation — ⬜ (new)

Inspiration: Cronometer's per-day action bar (FOOD / EXERCISE / BIOMETRIC / NOTE / FAST) + a single day log
that mixes biometrics and food. We adopt the *idea* (add anything to the day you're viewing) but keep our
simpler surface — only the types we support (food, biometric; exercise lands in M4). We don't plan to add
notes/fasting for now.

### 4.1 Fold "Add" into the Log page; add Food + Biometric on the viewed day

The "Add" flow should act on **the day you're looking at**, not a separate "today"-only tab.

- Remove the top-level **`capture` tab** from [App.tsx](web/src/App.tsx) (`Tab` union + tab bar) → tabs
  become **Log / Trends / Goals**.
- Add an action bar near the day header on [LogPage](web/src/pages/LogPage.tsx) with **"+ Food"** and
  **"+ Weight / Body fat"** (Cronometer-style, minus the types we don't support yet).
  - **+ Food** launches the existing capture flow ([CapturePage](web/src/pages/CapturePage.tsx): photo /
    text / recent → [EstimateCard](web/src/components/EstimateCard.tsx)) as a modal/sheet or in-page
    sub-view, with the new entry's date **defaulted to the viewed day** (entry-date support already exists).
  - **+ Weight / Body fat** opens the metric editor for the viewed day. Extract the inline edit form from
    [MetricCard](web/src/components/MetricCard.tsx) into a reusable `MetricEditor` shared by add + edit.
- Remove the weight quick-log card from [TrendsPage](web/src/pages/TrendsPage.tsx) → Trends becomes
  view-only charts. Backfilling = navigate to the day on Log and add (pairs with 5.2's day picker).
- **Effort:** M — mostly relocating existing components + a modal/sheet shell + dropping a tab.

### 4.2 Navigation

- **Calendar day-picker:** clicking `.day-nav__label` on [LogPage](web/src/pages/LogPage.tsx) opens a month
  calendar to jump to any day, with **days that have entries visually marked**.
  - Native `<input type="date">` can't color individual days → use a small custom month-grid popover (or a
    light calendar lib).
  - Day-marking source: reuse `GET /api/entries/range?from&to` across the visible month and mark dates with
    `entry_count > 0` (and optionally days with a body metric). A tiny dedicated "days-with-data" endpoint is
    an option if the range payload is too heavy.
- **Click a Trends value → open that day:** Recharts `onClick` on bars/points yields the datum's date; map
  back to a day key, switch to the Log tab, and set the Log day.
  - **Refactor:** LogPage owns its `day` state and App owns `tab`. Lift a `goToDay(dayKey)` (which sets both
    `tab='log'` and the day) to [App.tsx](web/src/App.tsx), or a small shared context. Prerequisite for cross-tab nav.
- **Effort:** M (calendar) + S (chart click + state lift).

---

## Milestone 5 — Activity & expenditure — ⬜

- **Model:** daily `Expenditure` row (`user_id`, `date`, `steps`, `steps_kcal`, `exercise_kcal`, `note`).
- **4.1 Steps → calories:** `kcal ≈ steps × weight_kg × k`. Needs latest `BodyMetric` weight (depends on 3.1).
- **4.2 Exercise logging:**
  - Add as option to Log page
  - Manual: kcal + description.
  - **Free-text AI estimate** ("30 min easy lifting"): add `analyze_activity_text` + `POST /api/analyze/activity`,
    mirroring `analyze_food_text` in [app/openrouter.py](app/openrouter.py) exactly (system prompt with MET
    tables → kcal + duration). High-reuse.
  - Double-count guard: optionally subtract step-derived kcal overlapping a logged workout — advanced; v1
    leaves it to the user.
- **Net-calorie integration:** [EnergySummary](web/src/components/EnergySummary.tsx) gains a gross/net
  toggle — `remaining = target − (intake − expenditure)`; thread per-day expenditure into
  [LogPage](web/src/pages/LogPage.tsx). **Effort:** M–L.

---

## Backlog — additional ideas, unsequenced — ⬜

- **Barcode scanning** ⭐ — PWA camera + `@zxing/browser` → barcode → **Open Food Facts** (free, no key) →
  exact packaged-food macros prefilled into a draft. Best accuracy/speed for packaged foods. (M)
- **Data export** — `GET /api/export` (CSV/JSON of entries + metrics). Cheap, valuable for a health log. (S)
- **Water tracking** — per-day counter. (S)
- **Weekly view + log search/filter** — beyond the day-by-day nav (partly addressed by 5.2's day picker). (S–M)
- **Streaks / adherence** — logging streak + on-target days. (S)
- **Offline robustness** — audit the installed `vite-plugin-pwa`: cache the shell, queue entry writes offline. (M)
- **Photo history gallery** — photos are already stored under `/data/photos`. (S)
- **Timezone note** — timestamps are naive local time; fine single-device, revisit if used across devices.

---

## Refactor checkpoints

- **M2 (auth) — ✅ done.** Real `current_user` dependency + single `user_query` scoping helper landed in
  [app/deps.py](app/deps.py); no router hand-writes the user_id filter.
- **Navigation — now scoped as M5.2.** The cross-tab "go to day" need finally forces lifting the selected
  day to App (or a context). Reassess React Router then (deep links / browser back) — still optional.
- **Opportunistic:** ✅ GoalsPage `setState`-in-effect fixed (query-wrapper + form-from-props); ✅ the 3.2
  range endpoint reuses day-summary aggregation. ⬜ Still pending: delete the unused
  `DailyTotals`/`EntryList` components.

---

## Dependency summary

```text
1.1/1.2 (nutrition) ──> 1.3 (density)           [done]
2 (auth) ── foundational, before 3/4            [done]
3.1 (weight) ──> 3.2 charts, 3.3 TDEE, 4.1 steps→kcal
5.2 (lift `day` to App) ──> Trends value → day navigation
```

---

## Verification (per feature)

- **Backend:** `pytest` (63 passing). Per feature, mirror existing tests — [test_entries.py](tests/test_entries.py),
  [test_targets.py](tests/test_targets.py), [test_metrics.py](tests/test_metrics.py),
  [test_auth.py](tests/test_auth.py), [test_analyze_text.py](tests/test_analyze_text.py); add a
  [test_migration.py](tests/test_migration.py)-style test per new column.
- **Frontend / e2e:** `tsc -b && vite build` + `eslint`; run backend (`uvicorn`) + `vite dev` and walk each
  flow.
