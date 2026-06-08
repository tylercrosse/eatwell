# Calorie Tracker — Feature Backlog

## Context

The app is a calorie tracker: FastAPI + SQLModel + SQLite on the backend (custom additive migrations in
[app/db.py](app/db.py), no Alembic), OpenRouter LLM estimation with optional USDA grounding
([app/openrouter.py](app/openrouter.py), [app/usda.py](app/usda.py)), and a React 19 + Vite + React Query
SPA with a plain-CSS dark theme and a tab-based shell ([web/src/App.tsx](web/src/App.tsx)).

Shipped so far: photo/text → AI estimate → reviewable entry, now **split into per-item entries**;
entries CRUD + per-day summary + meal grouping; extended nutrition (weight/fiber/sugar/sodium) + a
**Fullness Factor (satiety) score** with a food/drink volume readout and a drink-aware cap (replaced the
original calorie-density indicator); recent-food quick re-log (search + frecency + quick-add) and
**barcode scanning**; **Google-OAuth multi-user (allowlist, per-user scoping)**; **weight/body-fat logging
+ body goals**; **Recharts trends**; calorie/macro targets; editable entry dates; **activity/exercise
logging + expenditure** (manual + free-text AI estimate + steps→kcal) with a **net/gross energy toggle**;
**TDEE/BMR target recommender** (basic + adaptive); a **folded-in "Add" flow** (capture lives on the Log
page; tabs are Log / Trends / Goals) with a **calendar day-picker** and **click-a-Trends-value → open that
day**; and Trends charts for **expenditure, energy balance, predicted weight, a weight forecast, and goal
progress**.

**Decisions:** quick wins first → auth → health metrics/charts → activity; auth via **Google OAuth +
email allowlist** (closed access, no public signup); expenditure shown as **net = intake − expenditure
with a gross/net toggle**; charts via **Recharts**.

## Status legend

✅ Done · 🚧 Partial · ⏸ Deferred · ⬜ Not started

| Milestone | Status |
| --- | --- |
| M1 Quick wins | ✅ (1.4r a/b/d/e/f + barcode shipped; 1.4r c/g + 1.4 saved-foods/meals pending) |
| M2 Multi-user auth | ✅ |
| M3 Health metrics & insights | ✅ (3.1 + 3.2 + 3.3 all shipped) |
| M4 IA & navigation | ✅ |
| M5 Activity & expenditure | ✅ |
| M6 Per-item entries (split captures) | ✅ (live-classification tuning pending) |
| M7 Trends: expenditure line + balance weight prediction | ✅ (+ weight-forecast & goal-progress, beyond original plan) |

---

## Milestone 1 — Quick wins ✅

### 1.1 + 1.2 Extend the nutrition schema: numeric grams + fiber/sugar/sodium — ✅

Did these together as one schema/migration change. `weight_g`, `fiber_g`, `sugar_g`, `sodium_mg` added to
the analysis JSON schema + `FoodEntry` + entry schemas ([app/schemas.py](app/schemas.py),
[app/models.py](app/models.py)); migration via `_migrate_add_columns` ([app/db.py](app/db.py)); prompts +
USDA grounding (fiber `291`, sugars `269`, sodium `307`) updated; editable inputs in
[EstimateCard](web/src/components/EstimateCard.tsx) + [EntryRow](web/src/components/EntryRow.tsx).

### 1.3 Calorie-density indicator → **Fullness Factor** — ✅ (superseded)

Originally shipped as `density.ts` + `DensityBadge` (kcal/100g bands). **Replaced** by a **Fullness Factor**
(satiety) score — a per-100g cubic FF that folds in protein/fiber/fat, not just energy density:
[web/src/lib/fullness.ts](web/src/lib/fullness.ts) (`fullnessFactor` + tiers + `fullnessBreakdown`), color-coded
[FullnessBadge](web/src/components/FullnessBadge.tsx) on entries + estimate card, a per-meal fullness pill
([MealSection](web/src/components/MealSection.tsx)), and a day-level fullness meter (tier mix + calorie-weighted
average) in [EnergySummary](web/src/components/EnergySummary.tsx). Added a **food-vs-drink volume** readout
(per meal + per day) and an AI **`is_beverage`** flag (`FoodEntry` column + analysis schema + prompts) that
**caps drinks** at the lowest tier (liquid calories barely satiate) and counts their mass as drink volume, not
food bulk. `density.ts` / `DensityBadge` deleted. M6 (below) makes this fully effective by splitting multi-food
captures into per-item entries.

### 1.4 Recent / favorite foods + quick re-log — 🚧

- **v1 (recent):** ✅ `GET /api/foods/recent` ([app/routers/foods.py](app/routers/foods.py)) + recent-food
  list on the capture flow, prefilling a draft with no AI call.
- **v2 (saved foods):** ⬜ `SavedFood` table + `/api/foods` CRUD + ⭐ toggle.
- **v3 (saved meals/combos):** ⬜ stretch.

#### 1.4r — Recent-list quality & UX follow-ups — 🚧

**Shipped this session:** a (search), b (frecency), d (quick-add), e (richer chips), f (remember serving) —
the Findability + Faster-re-log set. **Remaining:** c (meal context, deprioritized) and g (smarter dedup).

**Context — why.** v1 shipped a *pure-recency* list: [foods.py](app/routers/foods.py) scans the last 500 entries
(`_SCAN_LIMIT`), sorts `logged_at DESC`, dedupes case-insensitively by `food_name` (latest wins), and returns 15.
The capture UI ([CapturePage](web/src/pages/CapturePage.tsx)) calls `getRecentFoods()` with **no query** and renders
chips of **name + kcal** only; tapping routes through `draftFromRecent` → review card with `servings` reset to 1.
Three weaknesses follow: (a) a daily staple drops off the list once 15 *other* distinct foods are logged after it —
and the 500-row scan cap means true frequency is never counted; (b) **search exists on the backend but is unused**;
(c) dedup is exact-name, so naming drift fragments a food into several chips. These items refine v1; **v2 (⭐ pin)**
and **v3 (saved meal combos)** above remain the answer for "force this to the top" and "log my usual breakfast."

Ranked by ROI (highest first):

- **1.4r.a Wire up search / typeahead — S (top quick win, frontend-only).** The `q` substring filter already exists
  ([foods.py](app/routers/foods.py) `ilike`) and `getRecentFoods(q)` already accepts it
  ([api/foods.ts](web/src/api/foods.ts)) — [CapturePage](web/src/pages/CapturePage.tsx) just never passes one. Add a
  debounced search input above the chips, fold `q` into the query key (`['foods','recent', q]`). Lets the user reach
  *any* prior food, not only the top 15. No backend change.
  → ✅ **Shipped:** 250ms-debounced search input; `placeholderData: keepPreviousData` avoids flicker; limit widened
  to 30 while a search is active; the section (and its box) stays visible on an empty result so it can be edited.
- **1.4r.b Frecency ranking — M (biggest quality gain).** Replace the Python scan/dedup ([foods.py](app/routers/foods.py))
  with a SQL aggregate: `GROUP BY lower(food_name)` → `COUNT(*)` (frequency) + `MAX(logged_at)` (recency), score
  `= count × recencyDecay(days_since_last)`. Removes the 500-row cap (true all-time frequency) and surfaces staples.
  Carry the latest row's macros/serving as today. Add `sort=frecency|recent` so "most recent" stays available.
  → ✅ **Shipped** (pragmatic variant, no window functions): collapse the scan window to the latest row per name
  (candidate set + macros/serving), then a separate all-time `GROUP BY lower(trim(name))` `COUNT(*)` supplies true
  frequency; `score = count × 0.5 ** (days_since_last / 14)` anchored at the newest entry (deterministic, testable).
  `sort` defaults to `recent` (back-compat — existing tests unchanged); the frontend requests `frecency`, which also
  returns `times_logged`. A food not logged within the scan window stays hidden (acceptable: it's genuinely stale).
- **1.4r.c Meal / time-of-day context — M.** Capture is launched for a specific meal (the M4 action bar will pass it).
  Boost foods historically logged at that meal / time window so breakfast shows breakfast foods first. Backend: a
  `meal=` filter or per-food meal distribution; frontend passes the current meal. Builds on 1.4r.b's aggregate.
- **1.4r.d Quick-add without review — S.** `onPickRecent` ([CapturePage](web/src/pages/CapturePage.tsx)) always routes
  to the [EstimateCard](web/src/components/EstimateCard.tsx) review state. Add a one-tap "quick log" (a ✓ on the chip /
  long-press) that posts directly (servings 1, current meal/day) via the existing `postEntry` path, skipping review.
  → ✅ **Shipped:** a ✓ button on each chip posts immediately (with the remembered serving, viewed day, inferred
  meal) by reusing the existing batch-save path, then closes the capture; tapping the chip body still opens review.
- **1.4r.e Richer chips — S.** Chips show only name + kcal. Add a compact second line: macros or a
  [FullnessBadge](web/src/components/FullnessBadge.tsx), a "logged N×" count (from 1.4r.b), and/or last-logged relative
  time — to disambiguate similar names. Keep it compact.
  → ✅ **Shipped:** second line = compact [FullnessBadge](web/src/components/FullnessBadge.tsx) + protein grams +
  `N×` count (when >1). Serving/last-logged omitted to stay compact; serving is restored on tap (1.4r.f) anyway.
- **1.4r.f Remember typical serving — S.** `draftFromRecent` resets `servings` to 1 and parses base via
  `parseServingSize` ([serving.ts](web/src/lib/serving.ts)); prefill the food's most-common (or last) servings instead.
  → ✅ **Shipped:** `draftFromRecent` divides the stored *total* macros by the parsed servings to recover the
  per-serving baseline, then restores that multiplier — so "2× 1 bowl" re-opens as 2 servings with no double-count.
- **1.4r.g Smarter normalization / dedup — S (careful).** Dedup is exact case-insensitive name, so "Greek yogurt",
  "greek yogurt bowl", "Greek Yogurt (1 cup)" fragment. Normalize more before grouping (trim trailing
  parentheticals / serving suffixes / punctuation) — conservatively, to avoid merging genuinely different foods.
  Pairs with 1.4r.b's GROUP BY key.

**Remaining:** 1.4r.c (meal context — deprioritized) and 1.4r.g (smarter dedup; current dedup kept conservative at
case-insensitive trimmed name). Both are independent follow-ups.
**Verification (done for a/b/d/e/f):** backend `pytest` green (91 passing) — frecency ordering, `times_logged`, and
`sort` validation added to [test_foods.py](tests/test_foods.py); frontend `tsc -b && vite build` + `eslint` clean.
Manual to spot-check live: log a staple across several days plus a fresh one-off → staple still ranks first; type in
the search box → reaches an older food; tap a chip → serving is remembered; press ✓ → logs and closes without review.

---

## Milestone 2 — Multi-user via Google OAuth + allowlist — ✅

`User` model + [app/auth.py](app/auth.py) (Google ID-token verify + session JWT) + auth router
([app/routers/auth.py](app/routers/auth.py): `/auth/google`, `/auth/me`, `/auth/logout`); real
`get_current_user` + shared `user_query` scoping helper ([app/deps.py](app/deps.py)); every data route
scoped by `user_id`; owner-email backfill of pre-auth rows. Frontend login gate + Google Identity Services
button ([web/src/components/LoginPage.tsx](web/src/components/LoginPage.tsx)), `credentials: 'include'`,
build-time `VITE_GOOGLE_CLIENT_ID` (threaded through the [Dockerfile](Dockerfile)).

---

## Milestone 3 — Health metrics & insights — ✅

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

### 3.3 TDEE/BMR + adaptive target recommender — ✅ (basic + adaptive)

`height_cm`, `birth_year`, `sex`, `activity_factor` added to the profile/`Targets`; Mifflin-St Jeor BMR ×
activity = TDEE in [tdee.ts](web/src/lib/tdee.ts); [GoalsPage](web/src/pages/GoalsPage.tsx) recommends a
calorie target for the chosen `weekly_rate_kg` (rate signed by the goal direction), and the **adaptive**
variant infers real TDEE from the trailing 28-day weight trend vs intake. The same `expenditureBreakdown`
([energy.ts](web/src/lib/energy.ts)) feeds the Log-page net energy and the M7 Trends charts.

### Shipped beyond the original M3 plan

- **Editable entry dates** — date picker in the create ([EstimateCard](web/src/components/EstimateCard.tsx))
  and edit ([EntryRow](web/src/components/EntryRow.tsx)) flows, so a forgotten meal can be backfilled to a
  past day (`logged_at` date; helpers `dayKeyOf`/`withDayKey` in [date.ts](web/src/lib/date.ts)).
- **Weight/body-fat backfill** — date picker on the Trends quick-log card.
- **Body metric on the Log page** — [MetricCard](web/src/components/MetricCard.tsx) shows a day's
  weight/body-fat like an entry row, with the same edit/delete buttons (only on days that have one).

---

## Milestone 4 — Information architecture & navigation — ✅

Inspiration: Cronometer's per-day action bar (FOOD / EXERCISE / BIOMETRIC / NOTE / FAST) + a single day log
that mixes biometrics and food. We adopt the *idea* (add anything to the day you're viewing) but keep our
simpler surface — only the types we support (food, biometric; exercise lands in M4). We don't plan to add
notes/fasting for now.

### 4.1 Fold "Add" into the Log page; add Food + Biometric on the viewed day — ✅

→ **Shipped:** the `capture` tab is gone — [App.tsx](web/src/App.tsx) tabs are **Log / Trends / Goals**.
[LogPage](web/src/pages/LogPage.tsx) has an action bar (**🍎 Food / 🏃 Exercise / ⚖️ Weight**) that opens the
relevant editor in a [Modal](web/src/components/Modal.tsx) bound to the **viewed day**: Food → the capture
flow ([CapturePage](web/src/pages/CapturePage.tsx)), Exercise → [AddExercise](web/src/components/AddExercise.tsx)
(M5), Weight → the extracted [MetricEditor](web/src/components/MetricEditor.tsx) (shared by add + edit). The
Trends weight quick-log card was removed; Trends is view-only. (Exercise on the day exceeded the original plan,
which only listed Food + Biometric.)

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

### 4.2 Navigation — ✅

→ **Shipped:** a [DayPicker](web/src/components/DayPicker.tsx) month-grid popover opens from
`.day-nav__label` and marks days with data; clicking a Trends bar/point calls `goToDay(dayKey)`, which was
lifted to [App.tsx](web/src/App.tsx) (sets `tab='log'` + the day) and threaded into
[TrendsPage](web/src/pages/TrendsPage.tsx). React Router was not adopted (still optional — see refactor notes).

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

## Milestone 5 — Activity & expenditure — ✅

→ **Shipped** (model landed differently than the original sketch: no single `Expenditure` row — instead
**steps live on `BodyMetric`** and **workouts are their own `ExerciseEntry` table**, which made per-workout
edit/delete and the M7 range endpoint natural).

- **Model:** ✅ `ExerciseEntry` (`user_id`, `date`, `name`, `calories`, …) with CRUD + `GET /exercise/range`
  ([exercise.py](app/routers/exercise.py)); `steps` added to `BodyMetric`.
- **Steps → calories:** ✅ `stepsToKcal` ([activity.ts](web/src/lib/activity.ts)) using the latest weigh-in
  weight (depends on 3.1); step count entered on the metric/weight editor.
- **Exercise logging:** ✅ an Exercise action on the Log page → [AddExercise](web/src/components/AddExercise.tsx)
  (manual kcal + name) and a per-day [ExerciseSection](web/src/components/ExerciseSection.tsx). **Free-text AI
  estimate** shipped: `analyze_activity_text` + `POST /api/analyze/activity` (MET-table system prompt → kcal +
  name; [openrouter.py](app/openrouter.py), [analyze.py](app/routers/analyze.py)). Double-count guard left to
  the user as planned (GoalsPage advises keeping the activity factor at "Sedentary").
- **Net-calorie integration:** ✅ [EnergySummary](web/src/components/EnergySummary.tsx) has a persistent
  **net/gross toggle** (`net-mode`) built on `expenditureBreakdown` (BMR + activity + exercise + step burn);
  per-day expenditure is threaded through [LogPage](web/src/pages/LogPage.tsx).
- **Tests:** [test_exercise.py](tests/test_exercise.py), [test_analyze_activity.py](tests/test_analyze_activity.py).

---

## Milestone 6 — Per-item entries (split multi-food captures) — ✅

**Shipped:** per-item nutrition + dish/drink granularity in the analysis schema & prompts (6.1); a
`POST /api/entries/batch` endpoint (6.2); and a per-item review card — each detected item is its own row
(name + fullness badge + Drink toggle + macro editor), defaulting to separate entries with a **Combine** action
to merge a composite dish, saved in one batch (6.3). Backend tests added; build/lint/pytest green. Remaining:
tuning the model's split granularity against real photos (only verifiable live).

### Context — what shipped & the gap

This session replaced **1.3's calorie-density indicator** with a **Fullness Factor** (satiety) score and built on
it: per-food + per-meal + per-day fullness ([web/src/lib/fullness.ts](web/src/lib/fullness.ts),
[FullnessBadge](web/src/components/FullnessBadge.tsx), the day meter in
[EnergySummary](web/src/components/EnergySummary.tsx)), a food-vs-drink **volume** readout, and an AI
**`is_beverage`** flag that caps drinks (liquid calories barely satiate) and counts their mass as drink volume
rather than food bulk.

Those features are **per-entry**, but the capture flow collapses a multi-food photo/description into **one** entry:
the model returns `items[]` (per-food macros) yet [draftFromAnalysis](web/src/pages/CapturePage.tsx) joins the
names and sums the totals. A breakfast of fruit + yogurt + coffee + juice becomes a single row, which (a) can't
carry a meaningful `is_beverage` — it's part food, part drink, (b) blends four foods into one fullness score (FF
rates *one* food), and (c) dumps all weight into one volume bucket. It also hurts plain tracking: you can't
edit/delete/re-log one food, and Recent foods shows the blob.

**Decision:** the review card shows each detected item as its own row; **default to separate entries**, with the
option to **merge** selected rows into a composite (e.g. keep "rice + curry" together). Each saved entry is then
atomic, so the fullness/beverage/volume features work as-is with no further change.

**Granularity = dish/drink, not ingredient.** A composite dish stays ONE item: a *burrata salad with tomatoes* logs
as one "burrata salad" (not burrata + greens + tomatoes), because you eat it as a unit and its blended-plate
fullness is the honest number. Only independently-served things separate — the plate of food, the coffee, the
juice. The prompt (6.1) must define this boundary explicitly. **Asymmetry to design around:** merging an
over-split is trivial (Combine; the per-item data exists), but splitting an *under*-split isn't (no per-piece
nutrition to divide), so bias the prompt toward reliably separating distinct dishes/drinks while keeping each dish
whole. Over-splitting is recoverable in the card; under-splitting (lumping the tray) is the failure we're fixing.

### 6.1 Per-item nutrition (backend) — S

Each `items[]` element today is only `{name, calories, protein_g, carbs_g, fat_g}`. Extend it — and the strict
`FOOD_ANALYSIS_JSON_SCHEMA` (every new property must also be added to the item's `required`) — with per-item
`weight_g`, `fiber_g`, `sugar_g`, `sodium_mg`, `is_beverage` in [schemas.py](app/schemas.py). Update both prompts
(`_SYSTEM_PROMPT`, `_TEXT_SYSTEM_PROMPT`) in [openrouter.py](app/openrouter.py) to estimate these per item. Keep the
`total_*` fields (sanity check + single-item shortcut). A real per-item `weight_g` is what makes the split
trustworthy — it avoids a proportional-by-calories hack (a 240 g coffee has almost no calories).

The prompts must also **define the item boundary** (see Granularity above): one item per distinct dish or drink you
would log separately — keep a composite dish whole (a salad, sandwich, bowl, stir-fry is ONE item with combined
nutrition), and separate only independently-served things (each plate/side and every drink). Bias toward separating
distinct dishes/drinks reliably rather than splitting a dish into ingredients. Include a worked example in the
prompt (e.g. "fruit plate + yogurt + coffee + juice → 4 items; caprese/burrata salad → 1 item").

### 6.2 Batch create endpoint (backend) — S

`POST /api/entries/batch` taking `{entries: EntryCreate[]}`, inserting in one transaction and returning
`EntryRead[]` — atomic, one round-trip, one cache invalidation. Scope/own each row to the user exactly like
[create_entry](app/routers/entries.py). Mirror existing tests in [test_entries.py](tests/test_entries.py).

### 6.3 Review card → per-item rows (frontend) — L (the bulk)

[draftFromAnalysis](web/src/pages/CapturePage.tsx) returns a **list** of item-drafts (one per `items[]`), each an
editable mini-draft (name, macros, weight, fiber/sugar/sodium, `is_beverage`, servings).
[EstimateCard](web/src/components/EstimateCard.tsx) becomes a multi-row editor: per row a macro editor +
[FullnessBadge](web/src/components/FullnessBadge.tsx) + "Drink" toggle + a select checkbox; shared meal/date/photo
for the capture. A **Combine** action merges selected rows into one composite item (sum macros/weight; join names;
`is_beverage` only if every merged item is a drink). Save posts the non-merged rows as separate entries via 6.2
(shared `photo_ref`, `meal`, `logged_at`; per-entry `items_json`). Single-item captures and recent re-logs
([draftFromRecent](web/src/pages/CapturePage.tsx)) stay one row — no forced list chrome. Files:
[types/index.ts](web/src/types/index.ts) (extended `FoodItem` + batch type), [api/entries.ts](web/src/api/entries.ts)
(batch post), CapturePage, EstimateCard, [index.css](web/src/index.css).

### Edge cases / decisions

- **Single item** → one entry, no list chrome (unchanged feel).
- **Servings** become per-row (each item scaled independently).
- **Merge** `is_beverage` = true only if every merged item is a drink; else false.
- **Photo** shared across the split entries (no per-entry crop); deleting one entry leaves the shared photo (no
  photo GC today anyway).
- **Existing rows** unaffected — already individual DB rows; only the *creation* path changes.
- **Out of scope:** re-classifying `is_beverage` on an already-saved entry (an edit-row toggle) — separate small task.

### Verification (M6)

- Backend: `pytest` — per-item parsing in [test_analyze.py](tests/test_analyze.py) /
  [test_analyze_text.py](tests/test_analyze_text.py); batch insert + user-scoping in
  [test_entries.py](tests/test_entries.py).
- Frontend: `npm run build` (`tsc -b && vite build`) + `eslint`. Manual: photo of food + drinks → review shows N
  rows → save → N entries, each with its own fullness tier, drink cap, and food/drink volume; try **Combine** on two.

### Dependency

Builds on the shipped fullness / `is_beverage` work. **Sequence:** 6.1 → 6.2 → 6.3.

---

## Milestone 7 — Trends: expenditure line + energy-balance weight prediction — ✅

→ **Shipped (7.1–7.5):** the `GET /exercise/range` endpoint (7.1, [exercise.py](app/routers/exercise.py)); a
shared per-day `expenditure` memo (7.2); an **expenditure line** on the calories chart (7.3); an
**Energy-balance chart** with sign-colored net bars + a cumulative line and a `≈ kg` readout (7.4); and a
**Predicted-weight line** on the weight chart (7.5), all in [TrendsPage](web/src/pages/TrendsPage.tsx) gated on
profile completeness. Backend tests: [test_exercise.py](tests/test_exercise.py).

**Beyond the original plan (also shipped):**

- **Weight-forecast chart** — a dedicated card that extends the axis past→future to the goal-pace finish date,
  drawing actuals + EMA trend, the **Goal-pace** projection, and a **Predicted** line extrapolated at the recent
  average daily balance, with a readout of both ETAs (target-rate date vs recent-intake date).
- **Goal-progress tracks** — [GoalProgress](web/src/components/GoalProgress.tsx): per-metric (weight / body fat)
  progress bars on the metric's own scale with a predicted-pace marker, range-independent.
- **Robustness/polish:** weigh-ins now load on a fixed 2-year lookback (not the range selector) so the latest
  weight is always available; the predicted line/goal progress anchor at the window-start weight; synced chart
  cursors (`syncId`); padded weight y-domains; a tight calorie y-domain; shared `CHART_COLORS`
  ([colors.ts](web/src/lib/colors.ts), see refactor notes).

### Context — the gap

Trends (3.2) plots consumed calories and weight, and activity/expenditure has shipped (exercise CRUD,
[`expenditureBreakdown`](web/src/lib/energy.ts), [`balanceProjection`](web/src/lib/energy.ts)) — but
**expenditure never made it onto the Trends charts**. It's only shown for "today" in
[EnergySummary](web/src/components/EnergySummary.tsx). This surfaces expenditure across the range and uses
the daily **intake − expenditure** balance to predict weight change, so the modeled trajectory can be read
against the actual scale.

**Decisions (this session):** show expenditure **both** as a line on the calories chart *and* as a dedicated
energy-balance chart with net bars; predict weight via a **cumulative-balance predicted-weight line overlaid
on the weight chart** (anchored at the first logged weight; `Δkg = Σ(consumed − expenditure) / 7700`), so the
model is compared against actual weigh-ins rather than projected on its own.

All math reuses existing helpers — no new formulas: [`expenditureBreakdown`](web/src/lib/energy.ts),
[`stepsToKcal`](web/src/lib/activity.ts), `KCAL_PER_KG` (7700, [tdee.ts](web/src/lib/tdee.ts)). The dashed
goal-pace projection (commit `26125e2`, [TrendsPage](web/src/pages/TrendsPage.tsx)) is the rendering template.

### 7.1 Per-day exercise totals endpoint (backend) — S

No range endpoint for exercise exists (only `GET /exercise?date=`, one day). Add
`GET /api/exercise/range?from&to` mirroring [`entries_range`](app/routers/entries.py): group `ExerciseEntry`
rows by `date`, sum `calories`, return a sparse `list[ExerciseDaySummary]` (`{date, total_calories,
entry_count}`). New `ExerciseDaySummary` schema in [schemas.py](app/schemas.py); route in
[exercise.py](app/routers/exercise.py) (place above the `/exercise/{id}` PATCH/DELETE for clarity). Client:
`getExerciseRange(from, to)` in [api/exercise.ts](web/src/api/exercise.ts); `ExerciseDaySummary` type in
[types/index.ts](web/src/types/index.ts). Add tests mirroring [test_entries.py](tests/test_entries.py).

### 7.2 Per-day expenditure series (frontend) — M

In [TrendsPage](web/src/pages/TrendsPage.tsx) add an `exercise-range` query and a shared `expenditureByDay`
memo (consumed by 7.3/7.4/7.5):

- **Weight per day:** forward-fill the last known `weight_kg` ≤ that day (fall back to earliest logged) —
  BMR needs a weight every day but weigh-ins are sparse.
- **Exercise per day:** `exerciseRange[day].total_calories + stepsToKcal(metric.steps, weightForDay)`.
- **Total:** `expenditureBreakdown({ weightKg, heightCm, birthYear, sex, activityFactor, exerciseKcal,
  currentYear: new Date().getFullYear() }).total`. Returns `null` on incomplete profile → expenditure
  features hide and the charts degrade to today's behavior.

Same baseline+exercise additive caveat as EnergySummary — no change.

### 7.3 Expenditure line on the calories chart (frontend) — S

Add `expenditure` to each `calData` row; render `<Line dataKey="expenditure" name="Expenditure" .../>` on the
existing `ComposedChart` (new `burn: '#fb923c'` color), gated on profile completeness. The gap between the
stacked-bar top (consumed) and the line is the day's deficit/surplus at a glance.

### 7.4 Energy-balance chart (frontend) — M

New chart card after the calories chart: `net = consumed − expenditure` per day as bars colored by sign
(deficit green / surplus red via per-point `<Cell>`), a zero `ReferenceLine`, and a cumulative-net line.
Header readout: total net kcal over the range and `≈ kg` via `KCAL_PER_KG`. Empty state when profile is
incomplete.

### 7.5 Predicted-weight line vs actual (frontend) — M

Add `predWeight` to `weightData.rows`:

- Anchor at the first logged weight in range (`anchorKg`, `anchorDate`).
- Walk the axis accumulating `dailyNet = consumed − expenditure` **only on days with logged intake**
  (`entry_count > 0`) — never treat an unlogged day as a giant deficit; forward-fill the predicted value
  across gaps and `connectNulls`.
- `predWeight(day) = round1(kgToDisplay(anchorKg + cumNet / KCAL_PER_KG, unit))`.
- Render `<Line yAxisId="w" dataKey="predWeight" name="Predicted (balance)" stroke={COLORS.burn}
  strokeDasharray="2 3" .../>`. Visually distinct from the dashed-purple "Goal pace" (target rate) — this is
  the *actual-intake* model; divergence from `weight`/`trend` exposes TDEE or logging error.

### Edge cases / decisions

- **Incomplete profile** (no height / birth year / sex) → expenditure line, balance chart, and predicted
  line all hidden; existing charts unchanged.
- **Unlogged-intake days** excluded from the prediction (and shown as gaps in net bars), so a missed day
  doesn't fabricate a huge deficit.
- **Weight forward-filled** for BMR only; body-fat untouched.
- **Double-count** (high activity factor + logged exercise) — unchanged from today; GoalsPage already advises
  keeping activity at "Sedentary."
- **Units:** kcal always; weight via the existing `kgToDisplay` + kg/lb toggle.

### Verification (M7)

- **Backend:** `pytest` — `/exercise/range` per-day grouping, user scoping, and empty-range, mirroring
  [test_entries.py](tests/test_entries.py).
- **Frontend / e2e:** `tsc -b && vite build` + `eslint`. Run `uvicorn` + `vite dev`, log a few days of food +
  exercise + weights, open Trends → expenditure line tracks on the calories chart; energy-balance chart shows
  green/red net bars + cumulative line; weight chart shows the dashed "Predicted (balance)" line near the
  actual trend. Toggle kg/lb and the 7/30/90 range.

### Dependency

Builds on shipped 3.1 (weight), 3.2 (Trends/Recharts), and activity/expenditure
(`expenditureBreakdown`, exercise CRUD). **Sequence:** 7.1 → 7.2 → (7.3 ∥ 7.4 ∥ 7.5).

---

## Backlog — additional ideas, unsequenced — ⬜

- **Barcode scanning** ⭐ — ✅ **Shipped.** Camera scan via `@zxing/browser` (UPC/EAN only, lazy-loaded chunk +
  manual-entry fallback for blocked/absent cameras) in [BarcodeScanner](web/src/components/BarcodeScanner.tsx), wired as
  a "Scan a barcode" action on the capture flow ([CapturePage](web/src/pages/CapturePage.tsx) → `draftFromBarcode` →
  single-item [EstimateCard](web/src/components/EstimateCard.tsx)). Backend `GET /api/foods/barcode/{code}`
  ([foods.py](app/routers/foods.py)) backed by [barcode.py](app/barcode.py): **US-first** — USDA FoodData Central
  *Branded* by GTIN/UPC (reuses the existing key, per-100g→per-serving via `app.usda` helpers), falling back to **Open
  Food Facts** (worldwide, no key) for international items + US gaps and on a USDA outage. Per-serving macros prefill the
  draft; entries tagged `source='barcode'`. Tests: [test_barcode.py](tests/test_barcode.py).
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
- **Navigation — ✅ done (M4.2).** `goToDay(dayKey)` lifted to [App.tsx](web/src/App.tsx) (sets `tab` + day);
  the cross-tab "go to day" works from Trends. React Router still not adopted (deep links / browser back remain
  optional).
- **Opportunistic:** ✅ GoalsPage `setState`-in-effect fixed (query-wrapper + form-from-props); ✅ the 3.2
  range endpoint reuses day-summary aggregation; ✅ unused `DailyTotals`/`EntryList` components deleted.
- **Numeric inputs — ✅.** [useNumericDraft](web/src/lib/useNumericDraft.ts) hook extracted (transient
  empty/partial field while focused, commit-on-valid, re-sync on blur), shared by the macro/serving/number
  inputs ([MacroInput](web/src/components/MacroInput.tsx), [ServingsStepper](web/src/components/ServingsStepper.tsx),
  [NumberField](web/src/components/NumberField.tsx)).
- **Chart colors — ✅.** [CHART_COLORS](web/src/lib/colors.ts) palette extracted and mapped by *concept*
  (Recharts SVG attrs can't read CSS `var()`), so every chart reads consistently and the M7 additions reuse it.

---

## Dependency summary

```text
1.1/1.2 (nutrition) ──> 1.3 (density→fullness)              [done]
2 (auth) ── foundational, before 3/4/5                      [done]
3.1 (weight) ──> 3.2 charts ──> 3.3 TDEE ──> M5 steps→kcal  [done]
M4.2 (lift `day` to App) ──> Trends value → day navigation  [done]
M5 (activity/expenditure) ──> M7 (expenditure on Trends)    [done]
remaining: M1 1.4 v2/v3 (saved foods/meals), 1.4r c/g; backlog extras (export, water, …)
```

---

## Verification (per feature)

- **Backend:** `pytest` (**104 passing** as of this pass). Per feature, mirror existing tests —
  [test_entries.py](tests/test_entries.py), [test_targets.py](tests/test_targets.py),
  [test_metrics.py](tests/test_metrics.py), [test_auth.py](tests/test_auth.py),
  [test_analyze_text.py](tests/test_analyze_text.py), [test_exercise.py](tests/test_exercise.py),
  [test_analyze_activity.py](tests/test_analyze_activity.py), [test_barcode.py](tests/test_barcode.py); add a
  [test_migration.py](tests/test_migration.py)-style test per new column.
- **Frontend / e2e:** `tsc -b && vite build` + `eslint`; run backend (`uvicorn`) + `vite dev` and walk each
  flow.
