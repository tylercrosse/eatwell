# App Store Readiness Plan

Last updated: 2026-06-15

This document turns the current personal calorie-tracker project into a practical launch
backlog for selling on the Apple App Store. It is based on the current codebase shape:
FastAPI + SQLModel + SQLite backend, React/Vite PWA frontend, Google OAuth allowlist,
OpenRouter AI food/menu/activity estimation, Fly.io deployment, and local photo storage.

This is an engineering and product planning document, not legal advice.

## Executive Summary

The app is technically healthy for a side project: backend tests, frontend build, and
lint pass. The largest gaps are not core food-tracking features; they are App Store
distribution, billing, privacy, account lifecycle, AI cost controls, and operational
reliability.

Recommended launch posture:

1. Ship a native iOS wrapper around the existing app first, rather than rewriting the
   whole product.
2. Monetize with an auto-renewable subscription, not a one-time paid app, because AI
   estimation has ongoing marginal cost.
3. Make manual/barcode/recent logging usable even when AI quota is exhausted.
4. Add explicit first-run onboarding using the existing goals/targets model.
5. Add per-user LLM metering and daily caps before opening signup.
6. Keep infrastructure simple for a beta, but add backups, authenticated photo access,
   and a path to Postgres/object storage.
7. Handle privacy/account deletion/export before App Review.

## Current App Inventory

### Already Strong

- Core app flow exists: photo/text food analysis, menu scan, barcode lookup, recent
  foods, entry CRUD, metrics, exercise, trends, targets, themes, and guide/menu ranking.
- Backend routes are user-scoped through `get_current_user` and `user_query`.
- Image normalization strips EXIF and downscales uploads before model calls.
- PWA build exists and is installable.
- Fly deployment exists in `fly.toml`.
- Tests are broad for backend behavior.

### Main Gaps

- The app is a PWA, not an App Store iOS app.
- Public signup is not implemented; auth is Google-only with an allowlist.
- There is no Sign in with Apple.
- There is no onboarding completion state.
- There is no subscription/IAP/entitlement system.
- There is no general analytics or crash reporting.
- There is no per-user AI usage/cost ledger or quota enforcement.
- `/photos` is static and unauthenticated.
- There is no privacy policy, terms, support URL, data export, or account deletion.
- SQLite and local photo storage are acceptable for private/beta use but need backup and
  scaling decisions before paid launch.
- There is no public brand/landing-page surface, custom domain plan, or desktop/tablet
  web layout; the current web app is optimized around a narrow mobile shell.

## 1. App Store Distribution

### Recommendation

Use a native wrapper first, likely Capacitor, around the existing Vite app. This is the
lowest-effort route to StoreKit, Sign in with Apple, native permissions, App Store
metadata, and TestFlight while preserving the existing web UI.

Longer-term, consider Expo/React Native only if the webview wrapper becomes limiting
for camera UX, HealthKit, performance, background work, widgets, or offline features.

### Required Work

- Create an iOS shell.
- Add app icon, launch screen, display name, bundle id, versioning, and provisioning.
- Add native camera/photo-library permission strings.
- Add StoreKit support for purchases/subscriptions.
- Add Sign in with Apple support.
- Configure deep links or universal links if needed.
- Add TestFlight build flow.
- Create App Store screenshots, preview assets, support URL, marketing URL, privacy URL,
  and review notes.
- Provide Apple Review with a demo account or demo mode.

### Review Risk

Apple expects the app to be complete, stable, and reviewable. If login is required,
reviewers need full access. The backend must be live during review.

## 2. Onboarding

### Goal

Make first-run setup quick enough that users reach the logging flow fast, but complete
enough that calorie targets and recommendations are not nonsense.

### Suggested Flow

Step 1: Goal

- Lose weight
- Maintain
- Gain weight

Step 2: Body basics

- Unit preference: lb or kg
- Current weight
- Goal weight, optional for maintain
- Optional body-fat percentage

Step 3: Target recommendation

- Height
- Birth year or age
- Sex, only because the current TDEE formula needs it
- Activity level
- Weekly rate

Step 4: Confirm plan

- Suggested calorie target
- Macro split default
- "Start tracking" primary action
- "Edit later" secondary action for optional fields

### Data Model

Add fields to `User`:

- `onboarding_version: int`
- `onboarding_completed_at: datetime | None`
- `default_weight_unit: str | None`
- `created_platform: str | None`

Keep nutrition/body data in `Targets` and `BodyMetric`. Do not infer onboarding
completion forever from target values, because defaults can look valid.

### Information Architecture

After onboarding:

- Default first screen should remain Log.
- Goals should show the plan summary and allow edits.
- If onboarding is incomplete, gate only the recommendation-dependent features, not
  basic food logging.

### App Review/Product Safety

Add gentle guardrails:

- Warn on extreme calorie targets.
- Warn on very aggressive weekly weight change.
- Present AI estimates and TDEE outputs as estimates, not medical advice.
- Add "check with a clinician before medical decisions" language in policy/help copy.

## 3. Authentication

### Current State

The app uses Google Identity Services on the frontend, verifies Google ID tokens on the
backend, stores users by Google `sub`, and gates access with `ALLOWED_EMAILS`.

### Public Launch Options

Preferred lightweight public setup:

1. Sign in with Apple
2. Email magic link or passkey
3. Google sign-in as optional, if desired

If Google remains a primary sign-in option in the iOS app, add Sign in with Apple.

### Backend Changes

- Generalize `User` away from only `google_sub`.
- Add an `auth_identities` table:
  - `id`
  - `user_id`
  - `provider` (`apple`, `google`, `email`)
  - `provider_subject`
  - `email`
  - `created_at`
  - unique `(provider, provider_subject)`
- Keep email on `User` as the current contact email.
- Add account merge/link rules only if needed. Avoid building complex linking for v1.

### Required Account Features

- Sign out.
- Delete account from within app settings.
- Export data.
- Revoke provider credentials where applicable.
- Support email/contact route.

## 4. Monetization

### Recommendation

Use subscriptions. Avoid a paid-up-front app unless AI features are severely capped,
because every paying user can create ongoing model cost.

### Simple Plan

Free:

- Manual logging
- Recent foods
- Barcode lookup
- Limited AI scans per day, for example 3
- Basic trends

Plus:

- Higher AI cap, for example 40 food/menu/activity AI requests per day
- Menu scanner
- Goal-aware guide/assistant features
- Advanced trends/export

The exact feature split can change, but the key rule is: no user should be blocked from
basic non-AI logging just because they hit the AI cap.

### Pricing Logic

Track actual AI cost before fixing price. Apple In-App Purchase handles payment,
subscriptions, taxes, and many payment edge cases. The App Store Small Business Program
can reduce Apple's commission rate for eligible developers, but eligibility and exact
proceeds should be confirmed in App Store Connect.

### Implementation Pieces

Native app:

- StoreKit product loading.
- Paywall.
- Purchase/restore flow.
- Manage subscription button.

Backend:

- `subscriptions` or `entitlements` table.
- App Store Server API validation.
- App Store Server Notifications endpoint.
- Grace-period handling.
- Refund/revocation handling.
- Server-side entitlement checks on paid endpoints.

Suggested tables:

```text
entitlements
- id
- user_id
- source              apple
- product_id
- original_transaction_id
- status              active | expired | grace | revoked
- expires_at
- last_verified_at
- created_at
- updated_at

purchase_events
- id
- user_id
- source
- event_type
- transaction_id
- original_transaction_id
- product_id
- raw_json
- created_at
```

### Review Notes

Make paid features and subscription terms clear in App Store metadata and in the paywall.
Add restore purchases. Add account deletion language that explains billing continues
through Apple unless the user cancels.

## 5. Analytics And Diagnostics

### Recommendation

Start with first-party product analytics plus crash/error reporting. Avoid ad SDKs,
IDFA, and cross-app tracking for v1.

### Events To Track

Acquisition/onboarding:

- `app_opened`
- `signup_started`
- `signup_completed`
- `onboarding_started`
- `onboarding_completed`
- `paywall_viewed`
- `subscription_started`
- `subscription_cancel_detected`

Core activation:

- `food_add_opened`
- `ai_food_scan_started`
- `ai_food_scan_succeeded`
- `ai_food_scan_failed`
- `entry_saved`
- `barcode_lookup_succeeded`
- `recent_food_quick_added`
- `metric_logged`
- `exercise_logged`

AI quota/cost:

- `quota_remaining_viewed`
- `quota_hit`
- `ai_request_rejected_non_food`
- `ai_request_rejected_quota`
- `ai_request_rejected_global_budget`

Retention:

- `day_logged`
- `trend_viewed`
- `goal_updated`
- `settings_opened`
- `data_exported`
- `account_deleted`

### Event Properties

Keep properties low-risk:

- user id or anonymized internal id
- platform
- app version
- endpoint
- source (`photo`, `text`, `menu`, `activity`, `barcode`, `manual`)
- success/failure code
- latency bucket
- quota remaining

Do not send food descriptions, photos, body measurements, exact weights, or raw model
responses to analytics unless there is a very explicit reason and privacy disclosure.

### Diagnostics

- Add backend structured request/error logs.
- Add frontend crash reporting with PII scrubbing.
- Track 4xx/5xx rate per endpoint.
- Track AI latency, AI failure rate, and upstream provider errors.
- Add uptime checks for `/api/health`.

## 6. LLM Usage Tracking, Quotas, And Cost Control

### Current State

AI calls are made in `app/openrouter.py` through OpenRouter, invoked by:

- `POST /api/analyze`
- `POST /api/analyze/text`
- `POST /api/analyze/menu`
- `POST /api/analyze/activity`

There is no per-user quota, cost ledger, or global spend cap.

### Required Ledger

Add an `llm_requests` table:

```text
llm_requests
- id
- user_id
- endpoint              food_photo | food_text | menu_photo | activity_text
- model
- provider             optional
- status               started | succeeded | failed | rejected
- rejection_reason     quota | non_food | size | entitlement | global_budget | other
- prompt_tokens
- completion_tokens
- total_tokens
- cost_credits
- cost_usd_estimate
- openrouter_response_id
- input_bytes
- created_at
- completed_at
- latency_ms
- date_key              YYYY-MM-DD in user's relevant timezone or UTC policy
```

Store enough to debug billing and abuse. Do not store raw photos or raw prompts in the
usage ledger by default.

### Quota Enforcement

Server-side, before the model call:

1. Resolve current user.
2. Resolve entitlement tier.
3. Count today's succeeded and possibly started requests.
4. Check endpoint-specific daily limit.
5. Check global daily budget.
6. Create `llm_requests` row with `started`.
7. Call OpenRouter with a stable internal `user` identifier.
8. Update row with usage, cost, latency, status.

Suggested v1 limits:

- Free: 3 AI requests/day.
- Plus: 40 AI requests/day.
- Hard global cap: configurable daily dollar cap.
- Abuse cap: lower limit on repeated failed/rejected calls.

Manual logging, barcode lookup, and recent re-log should not count against AI quota.

### Food-Related Guardrails

Use layered enforcement:

- Route-level constraints: each endpoint has a narrow schema.
- Text pre-check: reject obviously unrelated descriptions before the model.
- Model schema: allow a structured "not food/menu/activity" result where relevant.
- Prompt: tell the model to return rejection for unrelated input.
- Logging: record `rejected_non_food`.
- UI: show a plain explanation and do not retry automatically.

For photo uploads, reject invalid files and oversized files before model calls. Image
normalization already helps cost.

### OpenRouter Controls

Use OpenRouter's usage accounting to capture token/cost details. Use OpenRouter's `user`
parameter with an internal id, not email. Also configure key budgets/guardrails as a
backstop. Do not rely on provider-side guardrails as the only quota system, because the
app needs per-user product behavior.

## 7. Privacy, Legal, And Account Lifecycle

### Data Types Collected

Likely App Store privacy categories for the current/future app:

- Contact info: email/name from auth.
- Health and fitness: weight, body fat, exercise, calorie goals, steps if used.
- User content: meal photos, food descriptions, menu photos.
- Identifiers: internal user id, Apple/Google provider id.
- Purchases: subscription status/purchase history.
- Usage data: product interaction analytics, if added.
- Diagnostics: crash/performance logs, if added.

### Required Documents

- Privacy policy.
- Terms of service.
- Support/contact page.
- Optional privacy choices page.

The privacy policy should explicitly cover:

- What data is collected.
- Why it is collected.
- Third-party processors, including AI providers/OpenRouter, auth providers, analytics,
  crash reporting, app stores, and hosting.
- Whether data is used for training. If provider routing can send prompts/photos to
  providers with different policies, disclose this or restrict providers.
- Retention rules.
- Account deletion.
- Data export.
- Contact information.

### In-App Account Deletion

Add in Settings:

- Delete account button.
- Confirmation screen.
- Explanation that deleting app data does not automatically cancel Apple billing.
- Link/button to manage subscription.
- Backend delete endpoint.

Backend should delete or anonymize:

- User row.
- Auth identities.
- Targets.
- Food entries.
- Body metrics.
- Exercise entries.
- Photos.
- LLM usage rows, or retain only anonymized aggregate records if needed for accounting.
- Analytics identity, if supported by analytics vendor.

### Data Export

Add `GET /api/export`:

- JSON first.
- CSV optional.
- Include entries, exercise, metrics, targets, and basic account info.
- Do not include raw images in v1 unless packaged export is needed; include photo refs
  or signed links only if safe.

## 8. Photo Storage And Security

### Current Risk

Photos are saved under `data/photos` and exposed by FastAPI static mount at `/photos`.
The UUID filename is hard to guess, but access is unauthenticated.

### Launch Requirement

Replace static photo access with authenticated access.

Options:

1. Authenticated FastAPI route:
   - `/api/photos/{ref}`
   - Check current user owns at least one entry with that `photo_ref`.
   - Return file response.

2. Object storage with signed URLs:
   - Store original/normalized image in S3/R2.
   - Generate short-lived signed URLs after ownership check.
   - Better long-term storage and CDN story.

### Thumbnails

If adding meal-photo UI, generate thumbnails on upload:

- `photos/{ref}.jpg`
- `photos/thumbs/{ref}.jpg`

Do not load full-size photos in diary rows.

### Retention

Decide:

- Keep photos until entry/account deletion.
- Or delete photos after N days unless user opts into photo history.

Document the policy in privacy copy.

## 9. Deployment And Scaling

### Current Deployment

Fly.io single service serves FastAPI and built PWA. SQLite and photos live on a persistent
Fly volume. Machines auto-stop.

### Paid Beta Recommendation

Keep Fly, but harden it:

- Set at least one machine always running if users pay.
- Add automated volume backups.
- Test restore.
- Add uptime checks.
- Add structured logs and alerting.
- Add global AI spend cap.
- Move photos to object storage before public App Store launch if possible.

### When To Move Off SQLite

SQLite is fine for a small paid beta if there is one writer service and backups. Move to
managed Postgres when any of these happen:

- More than one app server instance.
- Noticeable write contention.
- Need admin/reporting queries.
- Need reliable migrations/rollbacks.
- Need stronger backup/restore and observability.
- More than a few hundred active users with regular writes.

### Recommended Architecture Stages

Stage A: TestFlight/Beta

- Fly app
- SQLite volume
- Authenticated photo route
- Backups
- LLM ledger and caps

Stage B: Public v1

- Fly app
- Managed Postgres
- S3/R2 photo storage
- App Store subscriptions
- Analytics/crash reporting
- Admin dashboard/script for support

Stage C: Growth

- Separate API and frontend/native concerns
- Background jobs for notifications/subscription sync
- Read replicas or analytics warehouse if needed
- Model-cost optimization and caching

## 10. Product Polish And Trust

### App Store Listing

Needed:

- App name and subtitle.
- Category: likely Health & Fitness or Food & Drink. Confirm positioning.
- Screenshots showing real app screens, not only login.
- Clear subscription language.
- Support URL.
- Privacy policy URL.
- Review notes explaining AI estimates and demo access.

### In-App Trust

Add:

- "AI estimates are approximate" language near estimates.
- Confidence display already exists; keep it understandable.
- Food/photo privacy note near first AI use.
- Quota display for AI features.
- Offline/error states that do not lose user input.

### Accessibility

Before App Store launch:

- Check dynamic text behavior.
- Check color contrast across themes.
- Add proper labels for icon-only buttons.
- Avoid emoji-only controls in native App Store screenshots where clarity matters.

### Support/Admin

Minimum support tooling:

- Find user by email.
- See subscription status.
- See recent AI usage/cost.
- Trigger account deletion/export if user requests support.
- Inspect backend errors by request id.

## 11. Launch And Marketing Surface

### Goal

The product needs a public surface before it looks sellable: a name, promise, domain,
landing page, and web app experience that does not feel like an iPhone-only prototype on
desktop. This matters for App Store review, paid acquisition, organic search, support,
and users who want to manage their account or log food from a laptop.

### Brand Foundations

Decide the brand before making screenshots, App Store assets, or a landing page.

Required decisions:

- Product name.
- Short tagline.
- One-sentence positioning.
- Primary audience: lightweight AI food log, serious weight-loss tracker, macro coach,
  restaurant decision tool, or privacy-first tracker.
- Tone: calm, practical, non-shaming, and estimate-aware.
- Visual identity: logo/app icon, color palette, typography, food-photo treatment, and
  screenshot style.

Suggested positioning direction:

- "Less tedious food tracking with honest AI estimates and smarter meal decisions."
- Lead with the wedge: fast logging, menu/photo help, adaptive targets, and no ads.
- Avoid sounding like a medical or clinical nutrition product unless the compliance
  burden is intentionally accepted.

Brand deliverables:

- App icon that works at iOS sizes and as a PWA icon.
- Wordmark or simple text lockup.
- App Store subtitle.
- Landing-page hero copy.
- Screenshot captions.
- Support/privacy/terms page style.
- Short description for social previews and app metadata.

### Landing Page

Create a simple marketing site separate from the signed-in app. It should explain the
product without requiring login and should be stable enough to use as the App Store
marketing/support/privacy entrypoint.

Minimum sections:

- Hero: product name, literal value proposition, app screenshots, primary CTA.
- How it works: photo/text/barcode/recent food logging.
- Differentiator: menu scanner, staying-power insights, adaptive targets.
- Privacy/trust: no ads, clear AI disclosure, export/delete controls.
- Pricing: free vs Plus once monetization exists.
- FAQ: AI accuracy, privacy, subscriptions, data deletion, supported platforms.
- Links: App Store, web app, support, privacy policy, terms.

Implementation options:

1. Same repo, separate route/site:
   - Marketing site at `/`.
   - Authenticated app at `/app`.
   - API at `/api`.
   - Requires frontend routing and static-serving changes.

2. Separate marketing host:
   - Marketing at `www.example.com`.
   - Web app at `app.example.com`.
   - API at `api.example.com` or same as app.
   - Cleaner separation and easier SEO, but more deployment/configuration.

Recommendation for v1: use separate subdomains if the web app remains a PWA. It keeps
marketing pages public and cacheable while preserving a focused authenticated app shell.

Landing-page technical checklist:

- Real metadata: title, description, canonical URL, Open Graph/Twitter image.
- Fast static rendering; do not require the API for marketing content.
- Analytics events for CTA clicks and signup starts.
- Public support, privacy, and terms links.
- App Store smart banner once the native app exists.
- Screenshots generated from real app state, not placeholder mockups.

### Custom Domain And URL Plan

The Fly URL is fine for development, but not for a paid product.

Recommended structure:

```text
www.product.com       marketing site
app.product.com       signed-in web app / PWA
api.product.com       API, optional if app and API are not same-origin
support.product.com   optional help center later
```

Simpler alternative:

```text
product.com           marketing site
product.com/app       signed-in web app
product.com/api       API
```

Domain checklist:

- Buy domain and configure DNS.
- Configure Fly custom domains/certificates or chosen host certificates.
- Update `CORS_ORIGINS`.
- Update Google OAuth authorized JavaScript origins.
- Add Apple Sign in domains/return URLs if web auth is used.
- Set cookie security and SameSite behavior intentionally.
- Decide whether session cookies are host-only or shared across subdomains.
- Update `APP_REFERER` for OpenRouter attribution.
- Update PWA manifest `start_url`, icons, app name, theme color, and screenshots.
- Add redirects from old Fly URL or hide it from public use.
- Add monitoring for all public domains.

### Web App Responsive Layout

Current state: the web app is intentionally mobile-first. The app shell is capped around
`600px`, uses a bottom tab bar, and many flows are built like mobile sheets. That is good
for iPhone/PWA use, but on desktop it will feel underpowered and leave useful space idle.

Responsive goals:

- Mobile remains the primary capture/logging experience.
- Tablet and desktop become better for review, trends, goals, recipes, account settings,
  and data cleanup.
- The app should not become a marketing dashboard; it should stay dense, practical, and
  task-oriented.

Desktop/tablet layout ideas:

- Replace bottom tab bar with a left sidebar or top navigation at wider breakpoints.
- Use a two-column Log layout:
  - left: day picker, add actions, energy summary
  - right: meals, exercise, metrics
- Let Trends use full-width charts with side-by-side cards where useful.
- Let Goals use a wider two-column form instead of stacked cards.
- Make Guide/Menu scanner results easier to compare in a table/card grid.
- Keep capture/review flows in a constrained panel so food-entry forms do not become too
  wide.
- Add keyboard-friendly flows for desktop: quick-add, search, save, escape to close.
- Ensure modals/sheets have desktop-specific sizes, not only mobile full-screen behavior.

Responsive technical checklist:

- Add layout breakpoints around tablet and desktop widths.
- Replace app-wide `max-width` assumptions with page-specific containers.
- Audit fixed widths and `vw`-based controls for desktop.
- Add chart sizing tests or manual screenshots for mobile, tablet, and desktop.
- Confirm bottom safe-area behavior still works on iOS PWA.
- Keep tap targets large on mobile while allowing denser desktop controls.
- Use real data screenshots to verify Log, Trends, Guide, Goals, modals, and settings.

### Web App Packaging

The web app can remain useful even after a native app ships. Treat it as:

- A cross-platform fallback for Android/desktop users.
- An account management surface.
- A better place for data export, recipe editing, historical cleanup, and charts.
- A lightweight acquisition path from the landing page.

Needed:

- Public web URL that does not look temporary.
- Clear relationship between web subscription and iOS subscription.
- Restore/entitlement handling for users who subscribe on iOS but log in on web.
- Responsive account/settings pages.
- SEO-safe public pages and noindex authenticated app pages.

### Launch Assets

Before public launch, prepare:

- App Store screenshots for 6.7-inch, 6.5-inch/5.5-inch as required by current App Store
  Connect rules.
- Web landing screenshots at mobile and desktop sizes.
- Product logo/icon source files.
- Open Graph/social preview image.
- Press/support one-liner.
- Demo account with seeded data.
- Public changelog or release notes page, optional.

## 12. Recommended Roadmap

### Phase 0: Decision And Cleanup

- Choose native wrapper vs Expo/React Native.
- Decide pricing model and free/paid feature split.
- Decide whether Google remains.
- Decide photo retention policy.
- Decide product name, positioning, and domain.

### Phase 1: App Store Eligibility

- Native iOS shell.
- Sign in with Apple.
- Public auth without allowlist.
- Account deletion.
- Privacy policy, terms, support URL.
- Authenticated photo access.
- App Review demo account/mode.
- Custom domain configured for app/API.

### Phase 2: Cost And Monetization

- LLM usage table.
- Per-user AI quotas.
- Global budget cap.
- Entitlements table.
- StoreKit purchases.
- App Store Server Notifications.
- Paywall and quota UI.

### Phase 3: Onboarding And Activation

- First-run onboarding.
- Onboarding completion state.
- Recommended calorie target.
- Safer goal-rate warnings.
- Activation analytics.
- Landing page with CTA and signup tracking.

### Phase 4: Operational Readiness

- Backups and restore test.
- Error/crash reporting.
- Uptime monitoring.
- Support/admin scripts.
- TestFlight beta.

### Phase 5: Public Launch Polish

- Brand/app icon/screenshot pass.
- Desktop/tablet responsive app layout pass.
- App Store screenshots and metadata.
- Landing page copy, FAQ, pricing, and social previews.
- Accessibility pass.
- Privacy label final review.
- Pricing experiment.
- In-app review prompt after positive activation moment.

## 13. Open Questions

- Is this intended to be a serious nutrition/weight-loss product, or a lightweight AI
  food log? The answer affects medical/safety copy and App Store positioning.
- Should the app preserve meal photos long term, or only use them to generate estimates?
- Is HealthKit in scope for v1? It would improve weight/steps but increases native and
  privacy scope.
- What is the target gross margin per subscriber after Apple commission and AI costs?
- Should menu scanner and future assistant features be Plus-only?
- Do you want web/PWA users to share the same subscription entitlement as iOS users?
- What is the product name and domain?
- Should the landing page and app share one origin or use `www`/`app` subdomains?
- Is desktop web a first-class product surface or mainly an account-management fallback?

## Sources

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple Manage App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Apple Account Deletion Guidance: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple In-App Purchase: https://developer.apple.com/in-app-purchase/
- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Apple Sign in with Apple guideline announcement: https://developer.apple.com/news/?id=09122019b
- OpenRouter Usage Accounting: https://openrouter.ai/docs/cookbook/administration/usage-accounting
- OpenRouter User Tracking: https://openrouter.ai/docs/cookbook/administration/user-tracking
- OpenRouter Guardrails: https://openrouter.ai/docs/guides/features/guardrails/overview
- OpenRouter Provider Logging: https://openrouter.ai/docs/guides/privacy/provider-logging
