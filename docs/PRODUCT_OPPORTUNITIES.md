# Product Opportunities Backlog

Last updated: 2026-06-15

This document is a market-led backlog for features that could make the calorie tracker
more useful and more defensible. It is separate from `BACKLOG.md`, which is mostly an
implementation roadmap, and `COMMERCIAL_READINESS.md`, which covers commercialization and
App Store launch requirements.

## Positioning Thesis

The calorie-tracking market is crowded. A small app is unlikely to beat incumbents by
having the largest database, the most integrations, or the broadest recipe catalog.

The credible wedge is:

1. Make logging much less tedious.
2. Make the estimates honest and correctable.
3. Help users decide what to eat, not just record what happened.
4. Personalize from the user's real trend data without shaming them.
5. Stay lightweight, private, and inexpensive to operate.

The current app already points in this direction: photo/text logging, barcode lookup,
recent foods, menu scanner, guide/ranking, staying-power/fullness, exercise, body metrics,
and adaptive TDEE. The next features should compound those strengths instead of turning
the product into a broad, generic MyFitnessPal clone.

## What Users Expect

These are table-stakes features users often expect from modern calorie trackers. Some are
already present; the backlog notes focus on the missing or partial pieces.

### 1. Faster Repeat Logging

Current state: recent foods, frecency, search, quick-add, barcode, photo/text estimate.

High-value additions:

- Saved foods with preferred serving size.
- Saved meals/combos.
- Duplicate meal from yesterday or another date.
- Copy full day.
- Meal templates by time of day.
- "Log again" from entry rows and meal sections.
- Bulk edit meal/date for multiple entries.

Why it matters: retention depends on daily friction. The winning workflow is not AI every
time; it is AI once, then fast repeat logging forever.

Priority: P0

### 2. Recipe And Home-Cooking Support

Current state: no recipe model.

Expected features:

- Custom recipe builder.
- Import recipe from URL.
- Divide recipe into servings.
- Log one serving.
- Recalculate macros when ingredients change.
- Save recipe as a reusable food/meal.

Differentiated version:

- AI-assisted recipe parsing from text, URL, or photo of a recipe card.
- "I cooked this pot, it made 5 portions" flow.
- Leftover logging: make a batch once, log servings later.

Priority: P0 for simple custom recipes, P1 for URL/AI import.

### 3. Nutrition Label Scanning

Current state: barcode lookup exists, but not label OCR.

Expected features:

- Scan Nutrition Facts label.
- Extract serving size, calories, macros, fiber, sugar, sodium.
- Create a custom food if barcode lookup fails.
- Let user correct fields before saving.

Why it matters: barcode databases are incomplete or wrong. Label scanning creates a
fallback that also improves the user's personal database.

Priority: P0/P1

### 4. Apple Health Integration

Current state: manual weight, steps, exercise; no native HealthKit.

Expected features:

- Import weight.
- Import steps.
- Import workouts/active energy.
- Optional export of dietary energy and macros.
- Respect HealthKit permission granularity.

Why it matters: iOS users expect health apps to sync with Apple Health. It also reduces
manual metric entry and improves adaptive TDEE.

Priority: P1, after native iOS shell.

### 5. Water, Fasting, And Basic Habit Tracking

Current state: not present.

Expected features:

- Water tracking.
- Caffeine and alcohol tracking, possibly as nutrient goals.
- Intermittent fasting timer.
- Streaks or consistency indicators.
- Gentle reminders.

Why it matters: incumbents bundle these as "all-in-one" wellness features. They are not
defensible, but users notice when they are missing.

Priority: P2. Add only if it supports the app's main retention loop.

### 6. Micronutrients And Custom Nutrient Goals

Current state: calories, macros, fiber, sugar, sodium.

Expected features:

- Saturated fat, cholesterol, potassium.
- Vitamins/minerals for database-backed foods.
- Custom goals for sodium, fiber, sugar, protein, etc.
- Weekly nutrition view.

Why it matters: Cronometer's wedge is trustworthy detailed nutrition. Matching all
micronutrients is expensive, but a few practical nutrients could be valuable.

Priority: P2 unless the product shifts toward "nutrition quality" rather than "weight
and meal decisions."

### 7. Better Search And Food Database Quality

Current state: recent-user foods, barcode via USDA/Open Food Facts, USDA grounding for
text estimates.

Expected features:

- Search public foods directly, not only recent foods.
- Restaurant/common foods database.
- Verified vs user-created indicators.
- Personal foods database.
- Merge/dedupe personal foods.

Differentiated version:

- "Confidence and source" shown for every estimate: verified barcode, label scan,
  USDA-backed text, AI guess, manual.
- User corrections improve personal defaults.

Priority: P1.

### 8. Watch, Widgets, And Quick Capture

Current state: PWA only.

Expected features after native shell:

- iOS widget for calories remaining and quick add.
- Lock Screen widget.
- Apple Watch glance or complication.
- Siri Shortcut/App Intent: "log my usual breakfast" or "add water."
- Share-sheet capture from restaurant menus or recipe pages.

Why it matters: a tracking app has to be close to the moment of eating.

Priority: P2 after core native app and monetization.

## Differentiator Bets

These are more interesting than table stakes. They are the places this app could feel
meaningfully different.

### Bet 1: Decision Support, Not Just Tracking

Current assets:

- Menu scanner.
- Goal-aware guide/ranking.
- Staying-power scoring.
- Targets and adaptive TDEE.

Feature ideas:

- "What should I order?" from a menu photo.
- "Make this order fit my day" suggestions.
- "I want pizza tonight. What should lunch look like?"
- Restaurant mode: scan menu, pick option, optionally log it.
- "Best option under 700 kcal with 35g protein."
- "Lighter swap" suggestions grounded in the visible menu.

Why it could work: users often fail before logging, when deciding what to eat. Incumbents
mostly optimize the diary. A decision layer is more valuable than another calorie chart.

Risks:

- AI cost.
- Hallucinated menu items.
- Needs clear uncertainty and "estimated" language.

Priority: Differentiator P0.

### Bet 2: Anti-Tedium Logging

Feature ideas:

- Photo inbox: take photos now, estimate/log later.
- "Estimate later" mode for social meals.
- Voice/text natural-language logging.
- Duplicate yesterday's meal.
- Smart suggestions by time, location, and recent behavior.
- Passive draft creation from meal photos without forcing immediate review.
- One-tap "usual breakfast/lunch" shortcuts.

Why it could work: many users churn because logging is annoying. The app should optimize
for "I can recover from imperfect tracking" rather than "I must enter everything now."

Priority: Differentiator P0.

### Bet 3: Honest Estimates And Correction Memory

Feature ideas:

- Show source and confidence per logged item.
- Let users correct portion sizes quickly.
- Remember corrections for similar foods.
- Personal default portions.
- "This estimate is broad" warning for hard meals.
- Compare AI estimate against barcode/label/USDA when available.
- Personal calibration: if user always adjusts "latte" to 180 kcal, prefill that later.

Why it could work: AI photo logging is now common. Trust comes from being correctable,
not pretending to be exact.

Priority: P1.

### Bet 4: Staying Power And Hunger Feedback

Current assets:

- Fullness/staying-power model.
- Meal/day summaries.
- Guide and menu ranking can use this signal.

Feature ideas:

- "Why am I hungry?" daily/weekly insights.
- Meal staying-power trend.
- Low-satiety pattern detection: liquid calories, low protein, low fiber, high density.
- "Make this meal last longer" suggestions.
- Hunger rating 1-5 before next meal.
- Correlate hunger ratings with protein/fiber/volume.

Why it could work: most trackers tell users they exceeded calories. Fewer help explain
why a day was hard.

Priority: P1.

### Bet 5: Adaptive Weekly Check-In

Current assets:

- Weight trend.
- Adaptive TDEE.
- Goal rate.
- Energy balance charts.

Feature ideas:

- Weekly check-in screen.
- "Your estimated burn changed from X to Y."
- "Your target is producing about 0.4 lb/week loss."
- Suggest target adjustment, but require user approval.
- Confidence score based on logging consistency and weigh-in frequency.
- Maintenance mode after goal is reached.

Why it could work: MacroFactor's adaptive coaching is a strong user-valued wedge. The
current app already has much of the math; it needs a clearer product loop.

Priority: P1.

### Bet 6: Budget And Taste Aware Nutrition

Current assets:

- Menu scanner extracts price.
- Backlog already has cost/taste ideas.

Feature ideas:

- Food taste rating.
- "Would eat again" feedback.
- Cost per protein gram.
- Cost per 100 kcal.
- Budget-friendly meal suggestions.
- Rank menu options by nutrition value per dollar.
- Avoid recommending foods the user repeatedly downrates.

Why it could work: "healthy" advice often ignores cost and preference. A small app can
feel more personal by respecting both.

Priority: P2, but strategically interesting.

### Bet 7: Calm, Non-Shaming Tracking

Feature ideas:

- No red punishment UI for imperfect days.
- Range-based goals rather than single exact numbers.
- Weekly averages over daily perfection.
- "Good enough" logging mode.
- Recovery prompts after missed days.
- Hide calories mode for users who only want protein/fiber/habits.
- Maintenance and performance goals, not just weight loss.

Why it could work: calorie apps can make users feel judged. A calmer product can retain
people who quit stricter apps.

Priority: P1 as a design principle; individual features can be P2.

### Bet 8: Privacy-First Nutrition Tracker

Feature ideas:

- Clear data controls.
- Easy export.
- Easy account deletion.
- No ads.
- No cross-app tracking.
- Local-first drafts.
- User-controlled photo retention.
- Transparent AI provider disclosure.

Why it could work: privacy is a real complaint about large free/ad-supported apps, and
health/food data is sensitive.

Priority: P0 for trust, even if not a growth differentiator by itself.

### Bet 9: Delightful Feedback And Light Motivation

Feature ideas:

- Small, fast animations when food is saved, goals update, or a week is reviewed.
- Haptic feedback on native iOS for capture, save, barcode success, and milestone moments.
- Gentle streaks: logging days, protein-target days, weigh-in consistency, cooking at home,
  or "checked in this week."
- Streak freezes or "resume streak" language so a missed day is not punished.
- Milestone cards: first 7 days logged, 10 meals logged without AI, first week with 5+
  protein-target days, first menu scan used, first recipe saved.
- Weekly recap moments: "3 steady logging days", "2 high-staying-power breakfasts",
  "you used quick-add 8 times."
- Seasonal or themeable app icons.
- Tiny visual polish: skeleton loading states, optimistic save transitions, smooth chart
  reveals, card reordering animations, and satisfying empty states.
- Personal celebrations that reflect the user's chosen goal: consistency, protein,
  fiber, cooking, budgeting, or maintenance, not only weight loss.

Why it could work: functional trackers can feel clerical. A few tasteful moments make the
app feel cared for and reinforce the habits that actually matter. The bar is not a game;
it is a product that gives the user a small sense of progress without making missed days
feel like failure.

Guardrails:

- Avoid gambling-style rewards, leaderboards, shame, or infinite badges.
- Never celebrate unhealthy restriction or extreme deficits.
- Let users mute celebrations and streak prompts.
- Prefer consistency streaks and weekly averages over perfect-calorie-day streaks.
- Keep animations fast and respect reduced-motion preferences.

Priority: P1/P2. Use delight as polish around high-value flows first; do not build a
standalone gamification system before activation and retention are understood.

## Persona-Based Opportunities

### Busy Weight-Loss User

Needs:

- Fast logging.
- Low decision fatigue.
- Clear remaining calories/protein.
- Forgiving recovery from missed logs.

Build:

- Photo inbox.
- Usual meals.
- Duplicate meals/days.
- Restaurant/menu decision support.
- Weekly check-in.

### Home Cook

Needs:

- Recipes.
- Batch portions.
- Leftovers.
- Ingredient substitutions.

Build:

- Recipe builder.
- Recipe URL/text import.
- Batch/leftover flow.
- Personal ingredient defaults.

### Macro Athlete

Needs:

- Protein and calories hit reliably.
- Adaptive TDEE.
- Fast repeat meals.
- Export and Health integration.

Build:

- Weekly check-in.
- Macro ranges.
- Saved meals.
- Apple Health import/export.

### Nutrition Quality User

Needs:

- Fiber, sodium, sugar, maybe micronutrients.
- Better food quality signals.
- Less focus on weight.

Build:

- Custom nutrient goals.
- Nutrition quality score with transparent components.
- Weekly nutrient gaps.

### Restaurant/Social Eater

Needs:

- Estimate food they did not cook.
- Compare choices quickly.
- Log imperfectly without guilt.

Build:

- Menu scanner.
- Order assistant.
- Photo inbox.
- "Estimate later."
- Uncertainty-aware logging.

## Prioritized Candidate Backlog

### P0: High-ROI Table Stakes

1. Saved foods with preferred serving.
2. Saved meals and duplicate meal/day.
3. First-run onboarding and weekly check-in loop.
4. LLM quota/cost tracking from `COMMERCIAL_READINESS.md`.
5. Authenticated photo access and photo retention controls.
6. Label scan fallback for failed barcode lookup.
7. Photo inbox / estimate later.
8. Public food search or stronger USDA-backed food lookup.

### P1: Differentiator Core

1. Restaurant order assistant grounded in menu scanner results.
2. "Make this meal/day fit my goal" suggestions.
3. Estimate confidence/source labels everywhere.
4. Correction memory and personal default portions.
5. Apple Health import for weight, steps, and workouts.
6. Weekly adaptive target check-in.
7. Hunger/staying-power insights.
8. Recipe builder and batch leftovers.
9. Delightful save/check-in feedback and gentle streaks.

### P2: Useful But Not Immediate

1. Water tracking.
2. Fasting timer.
3. Widgets, Watch, Siri Shortcuts, App Intents.
4. Micronutrient expansion.
5. Grocery list and meal planning.
6. Taste ratings.
7. Cost tracking and value ranking.
8. Sharing with coach/family.
9. Seasonal icons, deeper animations, and richer milestone cards.

### Avoid For Now

- Building a giant public food database from scratch.
- Full social network/community.
- Huge recipe catalog.
- Complex meal-plan marketplace.
- Generic open-ended health chatbot.
- Gamification that makes the app feel punitive.
- Heavy badge economies, leaderboards, loot-box-like rewards, or anything that pressures
  unhealthy restriction.
- Any feature that adds AI calls automatically without user intent.

## Suggested Additions To `BACKLOG.md`

If these are folded into the main backlog, add them as new milestones after the current
M13:

### M14 - Logging Speed And Personal Database

- Saved foods.
- Saved meals.
- Duplicate meal/day.
- Public food search.
- Correction memory.
- Label scan fallback.

### M15 - Recipes And Home Cooking

- Custom recipe builder.
- Recipe import.
- Batch servings.
- Leftover logging.

### M16 - Decision Support

- Restaurant order assistant.
- "Make this fit my day."
- "What should I eat next?"
- Grounded recommendations with uncertainty.

### M17 - Native Integrations

- Apple Health import/export.
- Widgets.
- Watch/Siri/App Intents.
- Share extension.

### M18 - Behavioral Coaching

- Weekly adaptive check-in.
- Hunger/staying-power insights.
- Range-based goals.
- Non-shaming recovery prompts.

### M19 - Delight And Motivation

- Save/capture/check-in microinteractions.
- Gentle streaks with recovery language.
- Milestone and weekly recap cards.
- Native haptics and reduced-motion support.
- Empty/loading states with more personality.

## Validation Plan

Do not build all of this before learning. Validate in layers:

1. Instrument current flows: food logged, AI estimate corrected, quick-add use,
   repeat logging, menu scan completion, retention.
2. Interview 5-10 likely users and ask about the last time they quit tracking.
3. Prototype saved meals, duplicate day, and photo inbox first.
4. Put restaurant decision support behind an explicit beta flag.
5. Measure whether features reduce time-to-log and increase weekly active logging days.

Useful metrics:

- Time from "add food" to saved entry.
- Percentage of entries created without AI after initial setup.
- AI estimate correction rate.
- Barcode failure fallback success rate.
- Days logged per week.
- Week 1 and week 4 retention.
- Quota hit rate.
- Paywall conversion after activation.
- Percentage of users who complete a weekly check-in.

## Market Notes And Sources

Incumbents emphasize:

- Large food databases, barcode scanning, voice/photo logging, recipes, meal planning,
  water/fasting, device sync, and progress dashboards.
- Cronometer differentiates on detailed and trustworthy nutrient data.
- MacroFactor differentiates on adaptive macro coaching.
- Newer AI-native apps differentiate on photo-first simplicity.
- User complaints cluster around tedious logging, questionable data quality, paywalls,
  ads, privacy, and difficulty estimating restaurant/home-cooked meals.

Sources:

- MyFitnessPal feature overview: https://www.myfitnesspal.com/
- MyFitnessPal Meal Scan FAQ: https://support.myfitnesspal.com/hc/en-us/articles/360045761612-Meal-Scan-FAQ
- Cronometer feature overview: https://cronometer.com/index.html
- Cronometer free features: https://cronometer.com/blog/free-features/
- MacroFactor overview: https://macrofactor.com/macrofactor/
- Foodnoms overview: https://foodnoms.com/
- Lifesum overview: https://lifesum.com/
- Lifesum App Store listing: https://apps.apple.com/us/app/lifesum-ai-calorie-counter/id286906691
- Yazio overview: https://www.yazio.com/en
- Cal AI App Store listing: https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616
- Apple HealthKit nutrition types: https://developer.apple.com/documentation/healthkit/nutrition-type-identifiers
- FDA Nutrition Facts Label guidance: https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label
