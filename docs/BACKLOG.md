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
  logging + burned** (manual + free-text AI estimate + steps→kcal) with a **net/gross energy toggle**;
  **TDEE/BMR target recommender** (basic + adaptive); a **folded-in "Add" flow** (capture lives on the Log
  page; tabs are Log / Trends / Goals) with a **calendar day-picker** and **click-a-Trends-value → open that
  day**; and Trends charts for **burned, energy balance, predicted weight, a weight forecast, and goal
  progress**.

**Decisions:** quick wins first → auth → health metrics/charts → activity; auth via **Google OAuth +
email allowlist** (closed access, no public signup); burned shown as **net = intake − burned
with a gross/net toggle**; charts via **Recharts**.

## Status legend

✅ Done · 🚧 Partial · ⏸ Deferred · ⬜ Not started

| Milestone                                                 | Status                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| M1 Quick wins                                             | ✅ (1.4r a/b/d/e/f + barcode shipped; 1.4r c/g + 1.4 saved-foods/meals pending) |
| M2 Multi-user auth                                        | ✅                                                                              |
| M3 Health metrics & insights                              | ✅ (3.1 + 3.2 + 3.3 all shipped)                                                |
| M4 IA & navigation                                        | ✅                                                                              |
| M5 Activity & burned                                      | ✅                                                                              |
| M6 Per-item entries (split captures)                      | ✅ (live-classification tuning pending)                                         |
| M7 Trends: burned line + balance weight prediction        | ✅ (+ weight-forecast & goal-progress, beyond original plan)                    |
| M8 Food Guide + Menu scanner                              | ✅                                                                              |
| M9 UI theming (5 themes) + Settings menu                  | ✅ (+ System picks a dark variant)                                              |
| M10 IA pass: unified nutrition/fullness + FF transparency | 🚧                                                                              |
| M11 Meal photos & visual identity                         | ⬜                                                                              |
| M12 Conversational meal/restaurant assistant & recipes    | ⬜                                                                              |
| M13 Cost & taste optimization dimensions                  | ⬜                                                                              |
| M14 Simple/Detailed view + meal-first logging             | 🚧                                                                              |

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
variant infers real TDEE from the trailing 28-day weight trend vs intake. The same `burnedBreakdown`
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

## Milestone 5 — Activity & burned — ✅

→ **Shipped** (model landed differently than the original sketch: no single `Burned` row — instead
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
  **net/gross toggle** (`net-mode`) built on `burnedBreakdown` (BMR + activity + exercise + step burn);
  per-day burned is threaded through [LogPage](web/src/pages/LogPage.tsx).
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

## Milestone 7 — Trends: burned line + energy-balance weight prediction — ✅

→ **Shipped (7.1–7.5):** the `GET /exercise/range` endpoint (7.1, [exercise.py](app/routers/exercise.py)); a
shared per-day `burned` memo (7.2); an **burned line** on the calories chart (7.3); an
**Energy-balance chart** with sign-colored net bars + a cumulative line and a `≈ kg` readout (7.4); and a
**Predicted-weight line** on the weight chart (7.5), all in [TrendsPage](web/src/pages/TrendsPage.tsx) gated on
profile completeness. Backend tests: [test_exercise.py](tests/test_exercise.py).

**Beyond the original plan (also shipped):**

- **Weight-forecast chart** — a dedicated card that extends the axis past→future to the goal-pace finish date,
  drawing actuals + EMA trend, the **Goal-pace** projection, and a **Predicted** line extrapolated at the recent
  average daily balance, with a readout of both ETAs (target-rate date vs recent-intake date).
- **Goal-progress tracks** — [GoalProgress](web/src/components/GoalProgress.tsx): per-metric (weight / body fat)
  progress bars on the metric's own scale with a predicted-pace marker, range-independent.
- **Body composition + coherent body-fat forecast** — [composition.ts](web/src/lib/composition.ts)
  derives lean (fat-free) and fat mass from `weight × (1 − bf/100)`. A new **Body composition** chart card
  in [TrendsPage](web/src/pages/TrendsPage.tsx) stacks fat + lean mass (summing to weight) over the measured
  range plus a lean-held-steady forecast, and reads out current lean/fat mass with deltas. The weight chart's
  body-fat projection is no longer an independent glide to the BF goal: it's now **derived from the
  predicted-weight line** (`predictBodyFatSeries`, lean held constant), so losing/gaining weight and body-fat
  change stay consistent. Lean mass is informational (no goal field, no backend change). Tested in
  [composition.test.ts](web/src/lib/composition.test.ts). *Possible follow-ups: data-driven lean-trend
  partition instead of holding lean constant; an optional lean-mass goal.*
- **Robustness/polish:** weigh-ins now load on a fixed 2-year lookback (not the range selector) so the latest
  weight is always available; the predicted line/goal progress anchor at the window-start weight; synced chart
  cursors (`syncId`); padded weight y-domains; a tight calorie y-domain; shared `CHART_COLORS`
  ([colors.ts](web/src/lib/colors.ts), see refactor notes).

### Context — the gap

Trends (3.2) plots consumed calories and weight, and activity/burned has shipped (exercise CRUD,
[`burnedBreakdown`](web/src/lib/energy.ts), [`balanceProjection`](web/src/lib/energy.ts)) — but
**burned never made it onto the Trends charts**. It's only shown for "today" in
[EnergySummary](web/src/components/EnergySummary.tsx). This surfaces burned across the range and uses
the daily **intake − burned** balance to predict weight change, so the modeled trajectory can be read
against the actual scale.

**Decisions (this session):** show burned **both** as a line on the calories chart *and* as a dedicated
energy-balance chart with net bars; predict weight via a **cumulative-balance predicted-weight line overlaid
on the weight chart** (anchored at the first logged weight; `Δkg = Σ(consumed − burned) / 7700`), so the
model is compared against actual weigh-ins rather than projected on its own.

All math reuses existing helpers — no new formulas: [`burnedBreakdown`](web/src/lib/energy.ts),
[`stepsToKcal`](web/src/lib/activity.ts), `KCAL_PER_KG` (7700, [tdee.ts](web/src/lib/tdee.ts)). The dashed
goal-pace projection (commit `26125e2`, [TrendsPage](web/src/pages/TrendsPage.tsx)) is the rendering template.

### 7.1 Per-day exercise totals endpoint (backend) — S

No range endpoint for exercise exists (only `GET /exercise?date=`, one day). Add
`GET /api/exercise/range?from&to` mirroring [`entries_range`](app/routers/entries.py): group `ExerciseEntry`
rows by `date`, sum `calories`, return a sparse `list[ExerciseDaySummary]` (`{date, total_calories, entry_count}`). New `ExerciseDaySummary` schema in [schemas.py](app/schemas.py); route in
[exercise.py](app/routers/exercise.py) (place above the `/exercise/{id}` PATCH/DELETE for clarity). Client:
`getExerciseRange(from, to)` in [api/exercise.ts](web/src/api/exercise.ts); `ExerciseDaySummary` type in
[types/index.ts](web/src/types/index.ts). Add tests mirroring [test_entries.py](tests/test_entries.py).

### 7.2 Per-day burned series (frontend) — M

In [TrendsPage](web/src/pages/TrendsPage.tsx) add an `exercise-range` query and a shared `burnedByDay`
memo (consumed by 7.3/7.4/7.5):

- **Weight per day:** forward-fill the last known `weight_kg` ≤ that day (fall back to earliest logged) —
  BMR needs a weight every day but weigh-ins are sparse.
- **Exercise per day:** `exerciseRange[day].total_calories + stepsToKcal(metric.steps, weightForDay)`.
- **Total:** `burnedBreakdown({ weightKg, heightCm, birthYear, sex, activityFactor, exerciseKcal, currentYear: new Date().getFullYear() }).total`. Returns `null` on incomplete profile → burned
  features hide and the charts degrade to today's behavior.

Same baseline+exercise additive caveat as EnergySummary — no change.

### 7.3 Burned line on the calories chart (frontend) — S

Add `burned` to each `calData` row; render `<Line dataKey="burned" name="Burned" .../>` on the
existing `ComposedChart` (new `burn: '#fb923c'` color), gated on profile completeness. The gap between the
stacked-bar top (consumed) and the line is the day's deficit/surplus at a glance.

### 7.4 Energy-balance chart (frontend) — M

New chart card after the calories chart: `net = consumed − burned` per day as bars colored by sign
(deficit green / surplus red via per-point `<Cell>`), a zero `ReferenceLine`, and a cumulative-net line.
Header readout: total net kcal over the range and `≈ kg` via `KCAL_PER_KG`. Empty state when profile is
incomplete.

### 7.5 Predicted-weight line vs actual (frontend) — M

Add `predWeight` to `weightData.rows`:

- Anchor at the first logged weight in range (`anchorKg`, `anchorDate`).
- Walk the axis accumulating `dailyNet = consumed − burned` **only on days with logged intake**
  (`entry_count > 0`) — never treat an unlogged day as a giant deficit; forward-fill the predicted value
  across gaps and `connectNulls`.
- `predWeight(day) = round1(kgToDisplay(anchorKg + cumNet / KCAL_PER_KG, unit))`.
- Render `<Line yAxisId="w" dataKey="predWeight" name="Predicted (balance)" stroke={COLORS.burn} strokeDasharray="2 3" .../>`. Visually distinct from the dashed-purple "Goal pace" (target rate) — this is
  the *actual-intake* model; divergence from `weight`/`trend` exposes TDEE or logging error.
- **Superseded:** the anchor now sits at the *most recent* (smoothed) weigh-in and projects **forward only**
  — not the first weight in range — via [predictWeightSeries](web/src/lib/forecast.ts) +
  [emaByDate](web/src/lib/stats.ts), so the line re-anchors to recent scale readings across travel gaps. The
  forecast chart also shades an uncertainty cone (see the unsequenced backlog item).

### Edge cases / decisions

- **Incomplete profile** (no height / birth year / sex) → burned line, balance chart, and predicted
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
  exercise + weights, open Trends → burned line tracks on the calories chart; energy-balance chart shows
  green/red net bars + cumulative line; weight chart shows the dashed "Predicted (balance)" line near the
  actual trend. Toggle kg/lb and the 7/30/90 range.

### Dependency

Builds on shipped 3.1 (weight), 3.2 (Trends/Recharts), and activity/burned
(`burnedBreakdown`, exercise CRUD). **Sequence:** 7.1 → 7.2 → (7.3 ∥ 7.4 ∥ 7.5).

---

## Milestone 8 — Food Guide + Menu scanner — ✅

Being built in the working tree right now (not yet committed). Documented briefly here because the
requested **M12 (chat/recipes)** and **M13 (cost)** build directly on it.

**What it does:**

- **Guide page** ([web/src/pages/GuidePage.tsx](web/src/pages/GuidePage.tsx),
  [web/src/lib/guide.ts](web/src/lib/guide.ts)) — ranks your own logged/recent foods for your goal
  (lose / gain / maintain) via `rankGuideFoods` → `rankFoodChoices`
  ([web/src/lib/choiceScan.ts](web/src/lib/choiceScan.ts)): a `choiceScore` blending fullness,
  protein-per-100kcal, fiber-per-100kcal, a calorie penalty, and beverage / low-fullness penalties.
  Plus curated static idea lists (protein anchors / volume builders / fiber carbs / calorie add-ons)
  and "less filling" patterns.
- **Menu scanner** ([MenuScanner](web/src/components/MenuScanner.tsx),
  [ChoiceScanResults](web/src/components/ChoiceScanResults.tsx),
  [MenuPhotoPreview](web/src/components/MenuPhotoPreview.tsx)) — photograph a restaurant menu →
  `POST /api/analyze/menu` ([analyze.py](app/routers/analyze.py), [openrouter.py](app/openrouter.py),
  [schemas.py](app/schemas.py)) extracts `MenuOption[]` (name, description, section, **price**, serving
  estimate, macros, `is_beverage`, confidence) → `choicesFromMenuResult` → a ranked best-choice list
  for your goal, sortable by recommended / menu / calories / protein / fullness.

**Status:** code + tests present ([tests/test_analyze_menu.py](tests/test_analyze_menu.py),
[web/src/lib/choiceScan.test.ts](web/src/lib/choiceScan.test.ts),
[web/src/lib/guide.test.ts](web/src/lib/guide.test.ts)). **Pending:** commit; build/lint/pytest
verification; live tuning against real menu photos; where Guide/Menu live in the Log/Trends/Goals tab
shell. This already carries the data hooks the requested items want — a goal-aware score (feeds M10) and
a per-item **`price`** (feeds M13).

---

## Milestone 9 — UI theming (5 themes) + Settings menu — ✅

→ **Shipped (9.1–9.5):** all five themes — **Light, Dark (slate), Black (GitHub), Cool (Solarized), Warm
(Gruvbox)** — plus **System**. Token architecture in [index.css](web/src/index.css): `:root` is the dark
base; each theme overrides the tokens via `:root[data-theme='…']`. Every hard-coded color was routed through
tokens (tints via `color-mix()` so they adapt per theme; new tokens `--bg-deep / --on-accent / --overlay / --shadow / --reticle` + a `--fullness-*` 5-tier ramp); only the camera letterbox stays intentionally black.
A **Settings** sheet ([SettingsMenu](web/src/components/SettingsMenu.tsx)) opens from a header gear
([App.tsx](web/src/App.tsx)) with swatch previews; `usePersistentChoice` added to
[prefs.ts](web/src/lib/prefs.ts). Charts are theme-aware via a palette-per-theme in
[colors.ts](web/src/lib/colors.ts) consumed through `useChartColors()` ([theme.ts](web/src/lib/theme.ts)) in
[TrendsPage](web/src/pages/TrendsPage.tsx) + [GoalProgress](web/src/components/GoalProgress.tsx). A no-flash
inline bootstrap in [index.html](web/index.html) applies the saved theme + iOS `theme-color` before first paint.

**Beyond the original plan:** **System resolves to a user-chosen dark variant** at night (a "Dark variant for
System" sub-picker; persisted as `theme-system-dark`, honored by the bootstrap too) — light has one option so
it isn't configurable yet. The theme module was split into [theme.ts](web/src/lib/theme.ts) (types/hooks/context)

+ [ThemeProvider.tsx](web/src/lib/ThemeProvider.tsx) (provider); `resolved` is derived during render via
  `useSyncExternalStore` (no setState-in-effect). User-facing labels (Black/Cool/Warm) are decoupled from the
  stable ids (`github-dark` etc.) that key storage/CSS/palettes.

**Follow-up (ties into M10):** the palettes were authored against the *current* token set. When M10.1 adds the
new fiber/satiety hues, those tokens must be added to all five `[data-theme]` blocks + the five chart palettes.

Requested: theme the UI — **Light, Dark (current), GitHub dark, Solarized dark, Gruvbox dark**.

**Context — today.** Every color is a CSS custom property in a single `:root` block
([index.css](web/src/index.css)): `--bg / --surface / --surface-2 / --border / --text / --muted / --accent / --accent-strong / --danger`, the macro colors, the burned colors, and `color-scheme: dark`.
The one hard-coupled exception: **chart colors are duplicated as hex literals in
[CHART_COLORS](web/src/lib/colors.ts)** because Recharts writes `fill`/`stroke` as SVG presentation
attributes that can't read `var()`. So a theme has **two surfaces to drive**: the CSS variables and the
JS chart palette. Prefs today are boolean-only ([usePersistentToggle](web/src/lib/prefs.ts)).

- **9.1 Token architecture — M.** Move `:root` to per-theme blocks keyed by `[data-theme="…"]` on
  `<html>`; keep the existing variable *names* as the contract and let each theme redefine them. Set
  `color-scheme: light|dark` per theme so native controls/scrollbars match. **Audit
  [index.css](web/src/index.css) for hard-coded colors** that bypass the tokens — the header
  `rgba(15,23,42,.85)`, the fullness tier colors (`.fullness--*` ~L596–612 and `.fullness-seg--*`
  ~L915–930) — and route them through variables. Themes only work if *everything* reads from tokens.
- **9.2 Chart palette per theme — S–M.** Make CHART_COLORS theme-aware: either (a) a
  `Record<ThemeName, Palette>` selected in React and passed into [TrendsPage](web/src/pages/TrendsPage.tsx),
  or (b) read resolved CSS vars via `getComputedStyle` on theme change and build the palette in JS.
  **Recommend (a)** (simpler, no layout read). Thread the active palette down instead of importing the const.
- **9.3 Settings menu (new home for prefs) — S–M.** Theme is the first occupant of a proper **Settings**
  surface (a [Modal](web/src/components/Modal.tsx) sheet or a small page) — the user wants this as "the start of
  a settings menu." It also becomes the home for prefs currently scattered or implicit: the **kg/lb** unit
  toggle ([units.ts](web/src/lib/units.ts)), the **net/gross** energy default ([EnergySummary](web/src/components/EnergySummary.tsx)),
  and future ones (default meal, photo/icon display from M11). Open it from a gear in the
  [App.tsx](web/src/App.tsx) header (next to sign-out).
- **9.4 Theme picker + persistence — S.** The theme control lives in 9.3's Settings. Add a sibling
  `usePersistentChoice<T extends string>(key, fallback)` next to `usePersistentToggle`
  ([prefs.ts](web/src/lib/prefs.ts)). Offer a **System** option (`prefers-color-scheme`). Apply `data-theme`
  from localStorage in a tiny inline script in [index.html](web/index.html) **before first paint** to avoid a flash.
- **9.5 All five palettes — S (data).** Ship tokens for all five at once: Light; Dark (current slate); GitHub
  dark (`#0d1117` bg / `#161b22` surface / `#c9d1d9` text); Solarized dark (base03 `#002b36` / base02 `#073642`
  / base0 `#839496`); Gruvbox dark (`#282828` / `#3c3836` / `#ebdbb2` + its red/green/yellow/aqua). Map the
  macro / burned / fullness hues into each palette's spirit (not just the neutrals) so charts stay legible.
  Mirror each palette in the JS chart map (9.2).
- Themed PWA `theme-color` meta + manifest background should follow the active theme (iOS status bar).

**Decided:** ship **all five themes at once** (not Light/Dark first). Rationale: the plumbing (9.1 tokens + 9.2
chart map + 9.3 settings + 9.4 picker) is the real cost and is paid once; with a clean token contract each extra
palette is ~data only, and building the contract against five palettes up front avoids baking in dark-only
assumptions that are painful to retrofit. Light remains the most per-palette work (shadows/overlays/`rgba` tuned
for dark need light counterparts) — budget for that within 9.5. Effort: **M–L** (the settings surface + getting
Light right lift it above the original M).

**Verification:** `tsc -b && vite build` + eslint; switch each theme and walk Log / Trends / Goals + modals
— charts, fullness pills, macro bars, and native inputs all reskin; reload keeps the choice with no flash.

---

## Milestone 10 — IA pass: unified nutrition/fullness presentation + FF transparency — 🚧

Requested: another IA pass — **consistency on how nutrition & fullness is presented, maybe more colors**,
and it's **unclear how the fullness factor is calculated / hard to get a high score**.

**Context — the inconsistency.** Nutrition/fullness is shown in several places with different grammars:
per-entry [FullnessBadge](web/src/components/FullnessBadge.tsx) pill (EntryRow, EstimateCard); per-meal
pill ([MealSection](web/src/components/MealSection.tsx)); the per-day fullness-meter (tier-mix bar +
calorie-weighted average + food/drink volume) in [EnergySummary](web/src/components/EnergySummary.tsx);
macros as stacked colors on Trends but bare numbers in editors; and now M8's Guide/Menu introduce *yet
another* vocabulary (`guideScore`, protein-per-100kcal, role badges). When is something a pill vs a bar vs a
number, and which colors mean what? No single answer today.

- **10.1 A nutrition design language — M (design-led).** Fix one mapping and document it (a tokens file or
  comment block) so Guide / Menu / Log / Trends stop reinventing: macro colors fixed everywhere (reuse the
  already-tokenized protein/carbs/fat on entry rows, not only charts); fullness always the 5-tier ramp;
  good/bad-vs-goal always accent/danger. **More colors:** add a distinct fiber hue and a satiety-emphasis
  accent; consider per-macro mini-bars on entry rows.
- **10.2 FF transparency — an explainer — S–M.** The score is opaque. Add an info affordance on the
  [FullnessBadge](web/src/components/FullnessBadge.tsx) / fullness-meter that opens a
  [Popover](web/src/components/Popover.tsx) breaking the score into its drivers — calorie density (dominant),
  protein, fiber, fat penalty, beverage cap: *"2.4/5 — mostly because it's ~210 kcal/100g; +0.4 from protein."*
  Expose a `fullnessExplain()` from [fullness.ts](web/src/lib/fullness.ts) returning the per-term deltas of the
  `41.7·cal^-0.7 + 0.05·protein + 0.000617·fiber³ − 0.0000725·fat³ + 0.617` formula. Directly answers "how is
  this calculated."
- **10.3 "Why it's hard to score high" — reframe, don't recalibrate — M.** The observation is correct and
  structural: the `41.7·cal^-0.7` term **dominates**, so the score is essentially *inverse calorie density*. A
  25–50 kcal/100g vegetable hits 4–5; a normal composite plate at ~150–250 kcal/100g lands ~1.8–2.3 (moderate)
  almost regardless of protein, because the protein/fiber terms are small add-ons. So "very filling" is
  effectively reserved for watery whole foods, and real restaurant meals feel stuck at moderate.

  **Decision (do not change the formula).** The absolute number being hard to max is *correct* — FF measures a
  fixed property of a food ("satiety per 100g"). Re-anchoring the tiers would only make "moderate" *feel* better
  without being more truthful, and would forfeit the grounding in the reverse-engineered nutritiondata formula.
  The real issue is that FF is the wrong *headline* for most decisions. Fix the framing with **one headline per
  context**:

  - **Per individual food** (entry row, recent chip, ingredient): keep FF, but present it **relative to the
    user's own logged foods** — "more filling than ~80% of what you eat" — alongside the tier label and the 10.2
    explainer. Relative position is motivating and *movable*; an absolute `2.3/5` is neither.
  - **Per meal / menu choice / Guide** (choosing what to order or cook for a goal): make the **goal-aware
    "smart pick" score** the headline — M8's `choiceScore` ([choiceScan.ts](web/src/lib/choiceScan.ts):
    protein-per-100kcal + fiber-per-100kcal + fullness, penalize beverages). FF appears as one *labeled input*
    inside its breakdown, not as a competing number.

  This resolves both complaints at once: the score stays honest, the user gets a signal they can actually move,
  and no surface shows two rival scores (which is the M10 consistency goal). Needs: a `fullnessPercentile()`
  helper (food vs the user's recent-foods distribution) and promoting `choiceScore` out of the Guide/Menu code
  into the shared nutrition vocabulary so Log/meal surfaces can use it too.
- **10.4 Log-page IA sweep — M.** With Guide/Menu (M8) and theming (M9) added, make one explicit pass over the
  tab shell (Log / Trends / Goals → where do Guide / Menu / Chat live?) and the EnergySummary stack ordering.
  Scoped to one deliberate pass, not a wholesale redo.

**Decided (FF):** keep the formula; reframe per context (relative percentile on foods, goal-aware `choiceScore`
as the headline on meals) + the 10.2 explainer. No tier recalibration.

**Verification:** build/lint; the explainer's numbers reconcile with `fullnessFactor`; macro + fullness colors
are now identical across Log, Trends, Guide, and Menu.

---

## Milestone 11 — Meal photos & visual identity — ⬜

Requested: **see photos of meals, or icons** — research how other calorie apps do this.

**Context.** Capture photos are already persisted (`/data/photos`, served at `/photos/<ref>`); entries carry
`photo_ref`. But the photo is never resurfaced — entry rows are text-only. The unsequenced list already has a
"Photo history gallery (S)"; this milestone expands it.

**How other apps do it (research summary — to validate, not gospel):**

- **MyFitnessPal / Lose It!** — a thumbnail on the diary row when a photo was attached, plus a separate photo
  timeline.
- **Foodvisor / Bitesnap / Calorie Mama** — the photo *is* the log: every entry is image-first and the diary is
  a photo grid.
- **Cronometer** — minimal imagery; leans on a dense food DB, food-group icons only.
- **Yazio / Lifesum** — friendly category **illustrations/icons** when there's no photo, for a lighter feel.
- **Takeaway:** two complementary directions — (a) **real thumbnails** where we already have them, and
  (b) **category icons/emoji** so every row (text, barcode, recent re-log) still gets a visual identity.
- **11.1 Thumbnails on entry rows — S–M.** Show a small `photo_ref` thumbnail on
  [EntryRow](web/src/components/EntryRow.tsx) when present; tap → full image in a
  [Modal](web/src/components/Modal.tsx). Needs a **resized variant** (a `?w=96` handled by the static layer, or
  a thumbnail generated on upload in [storage.py](app/storage.py)) so the diary doesn't pull full-res photos.
  Per-item split (M6) shares one photo across rows — decide: show it on each, or only the first.
- **11.2 Photo timeline / gallery — S.** A dated grid of meal photos (own view or a Trends card). Cheap given
  the photos already exist — mostly a `GET` listing `photo_ref`s with dates, scoped to the user.
- **11.3 Category icons / fallback — ✅ shipped (Wave A).** Every entry row leads with a theme-tinted chip
  showing the food's **visual form** (its vessel/silhouette), not a nutritional category — see the design note
  below. Two decoupled layers: a **resolver** (`food → category key`,
  [foodCategory.ts](web/src/lib/foodCategory.ts)) and a **renderer** (`key → SVG`,
  [foodCategoryIcons.tsx](web/src/lib/foodCategoryIcons.tsx) + [FoodIcon](web/src/components/FoodIcon.tsx)), so the
  icon *style* can be re-skinned later without touching the mapping. Taxonomy is 2-tier (~20 form-based Tier-1
  groups + ~100 Tier-2), the canonical list mirrored in [app/categories.py](app/categories.py) ⇄
  [foodCategory.ts](web/src/lib/foodCategory.ts).
  - **Classification:** the AI emits a Tier-1 `category` (enum in
    [openrouter.py](app/openrouter.py)/[schemas.py](app/schemas.py)); barcodes derive a Tier-2 from Open Food
    Facts `categories_tags` ([barcode.py](app/barcode.py)); a new nullable `category` column
    ([models.py](app/models.py), additive migration in [db.py](app/db.py)) persists it. The client resolver
    merges these with a keyword fallback so legacy/manual rows still get an icon.
  - **Mapping guardrails:** a barcode Tier-2 wins outright; else the trusted AI *group* polices the keyword
    *Tier-2* guess (agree → specific, conflict → group); word-boundary matching avoids substring traps; nothing
    confident → a neutral `food_generic`/`beverage_generic`. Covered by
    [foodCategory.test.ts](web/src/lib/foodCategory.test.ts) + [test_categories.py](tests/test_categories.py); the
    audit script [auditCategories.ts](web/scripts/auditCategories.ts) over the seeded personas shows 0 generic.
  - **Design north star:** group by what a food *looks like on the table* (plate / bowl / mug / glass /
    characteristic silhouette), because that is what an icon can honestly represent — this is why `breakfast`
    (a time) and a single `beverages` bucket are dissolved by vessel.
  - **Deferred (Wave B+):** custom/generated illustrations to replace the lucide line-icon placeholders
    (a few dish silhouettes — pasta, taco — currently share their vessel group's glyph), driven by the audit's
    group-only/generic tallies. Pure asset swap in `foodCategoryIcons.tsx`; no resolver/taxonomy change.

**Decisions / open:** storage growth + retention (no photo GC today — see README "deferred"); worth a cap if
galleries make photos first-class. Privacy is fine — photos are already user-scoped.

**Recommend 11.3 (icons) + 11.1 (thumbnails) first** — biggest perceived polish for least work, data already
exists. **Verification:** build/lint; thumbnails load resized (check payload size); icon fallback renders for a
barcode/recent entry; the gallery shows only the current user's photos.

---

## Milestone 12 — Conversational meal & restaurant assistant / recipes — ⬜

Requested: **some kind of chat for meal & restaurant instructions. Recipes?** Builds on M8 — the menu scanner
already turns a restaurant menu into ranked, macro-tagged options; this is the *generative* layer on top.

- **12.1 Restaurant order assistant — M.** Given a scanned menu (M8) or a restaurant name/cuisine, answer
  goal-aware questions: *"what should I order to stay under 700 kcal with 40 g protein?"*, *"how do I make this
  lighter?"* Backend: a `POST /api/assistant` (reuse [openrouter.py](app/openrouter.py) patterns) taking the
  `MenuOption[]` context + the user's targets/goal + the question. **Ground the answer in the already-extracted
  options** so it recommends real items with real (estimated) macros, not hallucinations.
- **12.2 Recipes / "make it at home" — M.** From a logged meal or a craving, generate a recipe scaled to a
  target (*"a 600 kcal, 45 g-protein version of this burrito bowl"*) → ingredients + steps + an estimated macro
  breakdown that one-taps into the existing entry-create path (reuse the estimate schema + EstimateCard / batch).
- **12.3 Meal-planning chat — L (stretch).** *"Plan dinners this week around my goal and what I usually log"* —
  pulls from recent foods (frecency exists) + targets. Defer.

**Design decisions / open:**

- **Chat vs structured.** Freeform chat is flexible but harder to ground and pricier per call. **Recommend
  starting structured** — a few canned questions + a free-text box, single-shot — cheaper, easier to keep
  grounded in the real menu/macros, and it can grow into multi-turn chat later.
- **Cost/latency** — extra LLM calls; gate behind an explicit button, never automatic.
- **Where it lives** — the Guide page or the menu-scan result screen (M8), not a new top-level tab unless it
  earns one (ties into the M10.4 IA sweep).

Effort: M (12.1, 12.2 each), L (12.3). **Sequence:** M8 → 12.1 → 12.2. **Verification:** backend test mirroring
[test_analyze_menu.py](tests/test_analyze_menu.py) (mock OpenRouter) asserting the assistant only references
items in the supplied menu context; a generated recipe's macros round-trip into an entry; build/lint.

---

## Milestone 13 — Cost & taste as optimization dimensions — ⬜

Requested: **cost and taste** — quality food can be expensive (find cheaper options), and some healthy food is
less tasty than others. Today the app optimizes purely on nutrition; this adds two more axes.

**Context.** The menu scanner (M8) already extracts a per-option **`price`**
([choiceScan.ts](web/src/lib/choiceScan.ts) `FoodChoice.price`, `MenuOption.price`) — so cost data is *already
flowing* for restaurant menus, just unused in scoring.

- **13.1 Cost: capture & surface — S–M.** Add an optional `price`/`cost` to entries (reuse the menu `price`).
  Surface cost-per-meal and cost-per-day, and — with macros — **cost per 100 kcal** and **cost per gram of
  protein** (the "protein on a budget" view people actually want). Mostly: a nullable column +
  schema/migration (the `_migrate_add_columns` pattern in [db.py](app/db.py)), an editor input, and a couple of
  derived readouts.
- **13.2 Cost in ranking — S.** Add cost as an *optional* term to the Guide/Menu `choiceScore`
  ([choiceScan.ts](web/src/lib/choiceScan.ts)): when prices are present, prefer cheaper at equal nutrition;
  expose a **"value"** sort (best nutrition per dollar). Extends existing scoring, no new infra.
- **13.3 Taste rating — M.** Let the user rate logged foods (1–5 "would eat again"), stored per food (or per
  `SavedFood` once 1.4 v2 lands). Use it to (a) re-rank Guide suggestions toward foods you actually like and
  (b) flag "healthy but you rated low" so suggestions aren't joyless — the antidote to a guide that only
  optimizes nutrition. Frecency is a weak *implicit* taste signal (you re-log what you like) that could seed it.

**Design decisions / open:**

- **Cost source** — manual entry is the realistic v1; menu prices are free (already extracted); per-region
  grocery-price APIs are out of scope.
- **Taste is per-user and subjective** — never aggregate/share; it only personalizes that user's ranking.
- **Multi-objective tension** — cheapest, tastiest, and most nutritious rarely coincide. Don't fold them into
  one opaque number; expose **separate sortable dimensions** (nutrition / value / "foods you like") so the user
  picks the trade-off — consistent with M10's "don't hide it in one score" stance.

Effort: S (13.1, 13.2) + M (13.3). **Sequence:** 13.1 → (13.2 ∥ 13.3); depends on M8 (menu price) and benefits
from **1.4 v2 (saved foods)** as the home for a persistent taste rating. **Verification:** migration test for
the new column(s) ([test_migration.py](tests/test_migration.py) pattern); "cost per g protein" + "value" sort
compute correctly; taste rating persists per user and shifts Guide order; build/lint.

---

## Milestone 14 — Simple/Detailed view + meal-first logging — 🚧

Driven by **first-time-user feedback**: the Log page reads as
too cluttered, picking a meal *after* starting to log feels backwards, macros aren't wanted, and "Balance"
isn't understood. Diagnosis: the friction is real, not just mental-model anchoring — but the fix is better
*defaults and disclosure*, not stripping features.

- **14.1 Simple/Detailed view toggle — S.** One persisted per-page switch
  (`usePersistentToggle('simple-view', …)`, [prefs.ts](web/src/lib/prefs.ts)), default **Detailed**. In
  Simple view, per-meal/per-entry macros + the staying-power adornment collapse
  ([MealSection](web/src/components/MealSection.tsx), [EntryRow](web/src/components/EntryRow.tsx)) and the
  energy summary drops the Consumed/Burned/Balance rings. One control answers
  "too cluttered" + "don't care about macros" + "don't understand Balance" at once.
- **14.2 Meal-first logging — S.** All four meals render always (even empty), each with a **"+ Add to {meal}"**
  button that scopes the capture flow to that meal up front ([LogPage](web/src/pages/LogPage.tsx) →
  `CapturePage initialMeal`), so the meal is chosen *before* logging instead of via a mid-flow dropdown. The
  global "Food" button stays as a time-defaulted quick path.
- **14.3 Grouped entry surface — S.** A section's entries read as one bordered card with inset dividers
  (`.entry-list--grouped`), instead of one floating card per row — applied to both meals and exercise
  ([MealSection](web/src/components/MealSection.tsx), [ExerciseSection](web/src/components/ExerciseSection.tsx)).
  Entry names wrap up to 3 lines, then truncate.
- **14.4 MyNetDiary-style Simple dashboard — S.** The Simple energy view is a big "kcal left" ring over a
  grid of at-a-glance tiles — Breakfast/Lunch/Dinner/Snacks (kcal) + Exercise + Steps
  ([EnergySummary](web/src/components/EnergySummary.tsx) `SimpleEnergySummary`). Meal tiles are tappable
  shortcuts into that meal's capture flow (reuse 14.2's wiring). No Water tile — the app doesn't track water.
- **14.5 Explicit "Budget" calorie framing — S.** The ring's net math (`goal + exercise − eaten`) was
  confusing because exercise silently inflated the goal. Now an explicit **`Budget = goal + exercise`** caption
  sits above the ring, the big number is **`left`** (`budget − eaten`), the ring fills relative to the budget,
  and the composition is spelled out below (`goal N + 🔥 N − eaten N`). **Caveat (conditional, already
  mitigated):** `calorie_target` is a stored, user-set field (default flat 2,000), so it normally carries no
  activity allowance and the budget is correct. Double-counting only arises if a user *both* applies the TDEE
  recommendation (`BMR × activity_factor`, [tdee.ts](web/src/lib/tdee.ts)) *and* keeps a non-sedentary activity
  factor — which the Goals page already warns against
  ([GoalsPage.tsx:260](web/src/pages/GoalsPage.tsx#L260)). Possible follow-up: upgrade that always-on hint into
  a conditional warning shown only when `activity_factor > 1.2` and activity is logged.

**Decisions:** one unified toggle (not two), default Detailed so the maintainer keeps full detail and the
casual user flips Simple once (persists per device); no new per-meal/per-entry routes — the Log page already
groups by meal and EntryRow expands inline, preserving meal context; keep the EstimateCard meal selector as a
pre-filled correction affordance.

**Possible fast-follows:** split into two toggles if power users want macros while simplifying Balance;
collapse the now-redundant meal selector in EstimateCard when `initialMeal` is set.

Effort: S. **Verification:** `cd web && npm run build` + lint + test; manually confirm toggle persistence,
Simple vs Detailed rendering, and that "Add to lunch" lands an entry in Lunch without touching the dropdown.

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
- **Data-driven forecast cone** — the Trends weight forecast now shades a heuristic uncertainty band
  ([bandHalfWidthKg](web/src/lib/forecast.ts): daily-noise floor + a linear systematic-bias term, capped).
  Once enough daily weigh-ins exist, estimate the user's own daily-weight σ from trend residuals and widen
  the band as √t (random-walk CI) instead of the fixed heuristic; consider asymmetric bounds when intake
  logging is sparse. (S–M)

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
M5 (activity/burned) ──> M7 (burned on Trends)    [done]
remaining: M1 1.4 v2/v3 (saved foods/meals), 1.4r c/g; backlog extras (export, water, …)

new work (M8–M13) — recommended order: M8 → M9 → M10 → M11 → M12 → M13
M8 (guide+menu, IN FLIGHT) ── land first: blocks clean tree; choiceScore+price feed M10/M12/M13
M9 (theme tokens + Settings) ✅ done ── deepest arch foundation; later UI now inherits themes for free
  └─ cross-cut: lock the full color-token vocab (M10.1 decision) BEFORE authoring the 5 palettes (M9.5)
M10 (FF reframe + design language) ── highest user value; built on M9 tokens, promotes M8 choiceScore
M11 (photos/icons) ── uses M10 design language + M9 Settings; mostly additive (needs thumbnail resize)
M12 (chat/recipes) ── depends on M8; isolated LLM endpoint
M13 (cost+taste) ── last: most new infra (cols/migrations); depends on M8 price + benefits from 1.4 v2
(M12 ∥ M13 are swappable — both only need M8)
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
