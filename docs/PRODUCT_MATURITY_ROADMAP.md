# Product Maturity Roadmap

Last updated: 2026-06-19

This document prioritizes calorie-tracker work by how strongly it improves product
credibility, demo quality, and the project's ability to explain itself to outside
readers.

This is not the general product backlog. The goal is to turn the app from "interesting
side project" into a tight product and technical proof point for:

- Shipping an end-to-end AI product.
- Designing human-in-the-loop AI workflows where users review and correct outputs.
- Evaluating and hardening model-backed features instead of treating the model as magic.
- Building production-shaped software: auth, deployment, tests, observability, privacy,
  cost controls, and useful documentation.
- Explaining the product judgment behind tradeoffs.

## Project Thesis

The strongest version of this project is not "AI calorie tracker." That category is
crowded and easy to dismiss as a wrapper. The stronger product story is:

> Built and deployed a mobile-first AI nutrition PWA that turns uncertain model outputs
> into reviewable, correctable workflows; added provenance, evals, cost controls, and
> decision-support features that help users choose what to eat rather than merely log
> what happened.

The project should demonstrate a durable pattern: identify a tedious workflow, build an
AI-assisted first draft, keep the human in control, test and harden the workflow, then
package the result so other people can use or understand it.

## Priority 1: Make The Project Demoable And Legible

Showcase value: high. Effort: small to medium.

The project needs to be easy for an outside reader or demo viewer to understand in less
than two minutes.

Recommended work:

- Add a public GitHub remote if appropriate.
- Tighten the README around a short product pitch, architecture diagram, screenshots,
  and a GIF or short demo video.
- Add a hosted demo URL or a clearly documented local demo path.
- Add demo/QA data so the app can be shown without exposing private logs.
- Add a portfolio write-up that explains the product problem, architecture, AI workflow,
  failure modes, and what changed after testing.
- Keep docs current enough that they look like intentional product thinking, not notes
  left behind by implementation drift.

Definition of done:

- Someone can open the repo and quickly see what the app does, how it is built, and why
  the AI workflow is designed the way it is.
- A non-private demo path exists.
- The README can support an external project link without extra explanation.

Proof point target:

> Built and documented a full-stack AI nutrition PWA with FastAPI, React, OpenRouter,
> SQLite, Google-auth gating, backend tests, and a deployable Fly.io/Docker setup.

## Priority 2: Add Provenance, Confidence, And Correction Tracking

Showcase value: very high. Effort: medium.

This is the most important product/AI credibility upgrade. The app should make it clear
where every estimate came from and what the user changed before saving.

Recommended work:

- Add an estimate source/provenance model: barcode, Open Food Facts, USDA, nutrition
  label OCR, menu scan, text estimate, photo estimate, manual entry, recent food, saved
  food, or user-edited copy.
- Surface source and confidence in the review UI, entry rows, and guide/menu results.
- Store user corrections separately from original model/database estimates.
- Track correction deltas for calories, protein, carbs, fat, fiber, serving size, and
  food name.
- Use correction history to improve future defaults for recent foods and saved foods.
- Add tests for provenance persistence and correction math.

Definition of done:

- A saved entry can answer: "What generated this estimate?" and "What did the user
  change before saving?"
- Correction data is queryable for evaluation and product analysis.
- The UI makes uncertainty legible without overwhelming the logging flow.

Proof point target:

> Added provenance-aware, human-in-the-loop estimate review that stores original AI or
> database outputs alongside user corrections, making model uncertainty auditable and
> usable for future defaults.

## Priority 3: Build A Lightweight AI Eval Harness

Showcase value: very high. Effort: medium to large.

This turns the project from "LLM integration" into "LLM product engineering." A small,
well-designed eval set is more impressive than adding more loosely specified AI features.

Recommended work:

- Create a labeled evaluation set of representative foods, meals, menus, and failure
  cases. Start with 50 examples; grow toward 100+ only if it remains useful.
- Include examples across photo estimation, text estimation, menu scans, barcode misses,
  restaurant foods, packaged foods, homemade meals, and ambiguous portion sizes.
- Measure calorie error, macro error, item extraction accuracy, serving-size error,
  latency, token/model cost, parse failures, and correction burden.
- Add a script or pytest target that runs the eval set against the current prompt/model.
- Store eval outputs in a structured artifact that can be diffed across prompt/model
  changes.
- Add a short eval report summarizing current performance, known failure modes, and
  launch gates.

Definition of done:

- Prompt/model changes can be compared against a stable fixture set.
- The app has a clear answer to "How do you know the AI estimates are good enough?"
- Known failure modes are documented and reflected in the UI or guardrails.

Proof point target:

> Built an eval harness for AI food and menu estimation, measuring accuracy, latency,
> cost, parse failures, and user-correction burden across a labeled fixture set.

## Priority 4: Push Menu And Guide Into Decision Support

Showcase value: high. Effort: medium.

The strongest product wedge is helping the user decide what to eat, not just logging
after the fact. This also maps well to AI enablement roles: AI prepares options and
tradeoffs, while the human makes the final decision.

Recommended work:

- Turn menu scan results into goal-aware recommendations: "best fit for today,"
  "highest protein under target," "lighter swap," and "more filling option."
- Let users compare menu options against current calorie/macro targets.
- Explain why an option is recommended using simple drivers: calories, protein, fiber,
  volume/fullness, sodium, and remaining daily budget.
- Allow "adjust this order" interactions: remove fries, add protein, half portion,
  dressing on side, swap side.
- Let users log or save the final choice with provenance attached.
- Keep uncertainty visible: menu analysis should say when an item is inferred,
  estimated, or missing nutrition detail.

Definition of done:

- A menu scan can lead to a concrete user action, not just a list of parsed items.
- Recommendation explanations are grounded in visible data and current user goals.
- The final logged entry preserves the source and any user modifications.

Proof point target:

> Designed goal-aware menu decision support that ranks restaurant options, explains
> nutrition tradeoffs, and lets users convert AI recommendations into reviewed log
> entries.

## Priority 5: Reduce Daily Logging Tedium

Showcase value: medium to high. Effort: small to medium.

This work is less flashy than AI, but it shows product judgment. A good tracker should
not force users through an AI call every time.

Recommended work:

- Add saved foods with preferred serving size.
- Add saved meals or meal templates.
- Add duplicate yesterday / copy meal / copy day.
- Add "log again" directly from entry rows and meal sections.
- Add photo inbox / estimate-later mode for social meals where immediate review is
  awkward.
- Add meal/time-of-day ranking for suggestions.
- Improve dedupe and merge flows for repeated foods.

Definition of done:

- Common repeat meals can be logged in one or two taps.
- The app's fastest paths do not depend on AI calls.
- Reuse flows preserve provenance and serving defaults.

Proof point target:

> Reduced repeat logging friction with saved foods, meal templates, and one-tap re-log
> flows, separating durable product value from expensive AI calls.

## Priority 6: Add Production Guardrails

Showcase value: medium to high. Effort: medium.

These features matter because they make the project feel safe to operate outside a
single-user beta.

Recommended work:

- Add per-user AI usage ledger: feature, model, tokens, estimated cost, latency,
  success/failure, and request class.
- Add daily/weekly caps and graceful fallback when AI quota is exhausted.
- Authenticate photo access instead of serving uploads as unrestricted static files.
- Add export and account deletion flows.
- Add backup/restore notes for SQLite and uploaded photos.
- Add minimal analytics for core funnel events: capture started, estimate generated,
  correction made, entry saved, quick log used, menu recommendation logged.
- Add structured error states for third-party failures and quota failures.

Definition of done:

- The app can explain and cap AI spend by user and feature.
- Private user content is not exposed through unauthenticated photo URLs.
- Basic account lifecycle and data portability are covered.

Proof point target:

> Added production guardrails for an AI-backed consumer app, including per-user usage
> metering, quota fallbacks, authenticated media access, and data export/delete paths.

## Priority 7: Get Real Usage Evidence

Showcase value: very high if available. Effort: variable.

Real usage turns project claims into outcomes. Even a small beta is useful if measured
honestly.

Recommended work:

- Recruit a small private beta group.
- Track meals logged, active days, repeat logging usage, AI estimate usage, correction
  rates, menu scans, and retained users after one or two weeks.
- Collect a short feedback form focused on friction, trust, and whether the AI estimates
  were useful enough to keep.
- Turn findings into one concise product memo: what users did, what failed, and what
  changed.

Definition of done:

- The project has credible usage numbers, even if small.
- The next product iteration is tied to observed behavior rather than guesses.

Proof point target:

> Ran a small beta, measured logging behavior and AI correction rates, and used the
> results to prioritize repeat-logging, provenance, and menu-decision workflows.

## Lower Showcase-ROI Work

These may be worthwhile for a real consumer launch, but they are weaker external
credibility signals unless they support one of the priorities above:

- Broad wellness features: water, fasting, habits, streaks.
- More themes or visual polish beyond what the demo needs.
- Full native iOS rewrite before the web/PWA story is strong.
- App Store subscriptions before usage, cost, and retention are proven.
- Large food database expansion without provenance or correction tracking.
- Micronutrient breadth unless the product strategy shifts toward Cronometer-style
  nutrition accuracy.

## Suggested Implementation Order

1. Make the repo/demo legible: README, screenshots, demo data, public/private decision.
2. Add provenance and correction tracking to the estimate review/save path.
3. Build the first 50-example eval set and report.
4. Upgrade menu scan into goal-aware decision support.
5. Add saved foods/meals and one-tap repeat logging.
6. Add usage/cost metering and quota fallbacks.
7. Run a small beta and write a short results memo.

## Strong Final Project Narrative

If the above work lands, the project can support a project write-up like:

> AI-Enabled Calorie Tracker - Built and deployed a mobile-first nutrition PWA with
> FastAPI, React, SQLite, and OpenRouter; added provenance-aware estimate review,
> user-correction tracking, and an eval harness measuring food/menu estimate accuracy,
> latency, and cost. Designed goal-aware menu decision support and low-friction repeat
> logging flows so users could act on AI recommendations without treating model output
> as ground truth.

If real usage exists, lead with that:

> Used by N beta users over N weeks to log N meals; measured AI correction rates and
> repeat-logging behavior, then prioritized provenance, saved meals, and menu-decision
> workflows based on observed friction.
