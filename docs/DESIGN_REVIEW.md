# Design Review — July 2026

> **Tracked in beads as `ct-dr.*`** — P1.1 → `ct-dr.1`, P1.2 → `ct-dr.2`, P1.3 →
> `ct-dr.3`, then P2.4–P2.8 → `ct-dr.4`–`ct-dr.8` and P3 → `ct-dr.9`–`ct-dr.14`.
> Run `bd list --label design-review` for live status. The "Status" section at the
> bottom is a point-in-time log; the beads are authoritative.

Reviewed against the screenshots in `docs/assets/screenshots/` (captured Jun 24, 2026) and
the current token system in `web/src/index.css`. Screens covered: Log, Add-food composer,
Trends, Goals, Guide, and the boot splash. Note that commits after Jun 24 reworked the
capture composer and splash, so some composer details below may already have moved.

## What's working

- **Card language is coherent.** Consistent radius, soft shadows, white surfaces on the
  cool gray background. Every screen clearly belongs to the same app.
- **The food card is the best component in the app.** Emoji icon, name, portion, kcal,
  macro dot-chips, secondary nutrients — high density but scannable, and it's reused
  faithfully across the composer and the Guide's ranked list.
- **Goals is the strongest screen.** Big thumb-friendly steppers, live gram conversion
  under the macro split, and the payoff line ("2.9 kg to lose · ~8 wks · est. Aug 21,
  2026") turns settings into feedback.
- **Real theming discipline.** The token system (dark / light / github-dark) is genuinely
  used; macro colors stay consistent across bars, chips, and legends.
- **Narrative analytics.** Trends leads with sentences ("predicted ≈ −3.8 kg"), not just
  charts. That's the right instinct for this product.
- **The emoji identity is distinctive.** The splash and food icons give the app a
  personality most trackers don't have.

## P1 — Fix first

### 1. The balance gauge is direction-blind — and red every afternoon by construction

The Balance dial is intentionally a *distance-from-goal* gauge (`balanceColor()` in
`web/src/lib/energy.ts`: green at the goal balance, ramping to red as the gap approaches
±600 kcal in either direction). Judging a too-steep deficit as "off plan" is a defensible
product stance. But two things undermine it as rendered:

- **The "(so far)" problem.** On the current day, the dial compares the *running* balance
  (consumed − burned so far) against an *end-of-day* plan balance. Before the last meal
  the gap is huge by definition, so the gauge is deep red every afternoon and can only
  turn green around bedtime. An indicator that is always red mid-day trains users to
  ignore it. The projection machinery already exists (`balanceProjection()` returns a
  projected end-of-day figure for today) — the gauge should judge that, not the running
  total.
- **Color alone can't say which side you're on or what to do.** Red-at-both-ends is fine
  for a needle gauge with a visible green zone; it fails as a tinted ring, where red
  simply reads "bad." "1122 below plan" in small red text doesn't rescue it. Same on
  **Trends:** the energy-balance bars use the same symmetric coloring, so a month of
  losing-faster-than-goal renders as a wall of red indistinguishable from a month of
  overeating, and the caption ("green = on your goal pace, red = off it") is the only
  decoder.

**Direction:** keep the symmetric judgment but make it legible: draw the dial as an
actual gauge (marked green zone at the plan balance, needle/dot showing which side), judge
today's *projected* balance rather than the so-far figure, and pair the color with a
one-line direction cue ("steeper than plan — room for ~X more kcal" / "above plan").
On Trends, encode direction (below-pace vs above-pace as distinct hues or bar
directions), not just distance.

### 2. The Log's plan summary is alarm-fatigued prose

Below the rings sit two center-aligned sentences of math, one with red inline text, one
entirely orange: "On plan (eat 2100 kcal): 1051 kcal/day deficit · ≈ lose 1.0 kg/wk ·
goal: lose 0.3 kg/wk" followed by "That 2100 kcal target trends to lose 1.0 kg/wk, not
your goal…aim to consume ~2766 kcal/day total." Problems: the two lines repeat each
other, the red/orange styling screams on what is arguably good news, and it's the
noisiest element on the app's most-visited screen.

**Direction:** collapse to one compact callout with a neutral info treatment — e.g.
"Pace: 1.0 kg/wk vs 0.3 goal · eat ~2766 kcal to match" — with a disclosure (the
`StayingPowerExplainer` pattern already exists) for the full math. Reserve red for
destructive/critical moments only.

### 3. Type scale sprawl and a legibility floor problem

`index.css` uses 30+ distinct font sizes; the most common are 0.78rem (~12.5px) and
0.72rem (~11.5px), with sizes down to 0.62rem (~10px). Most of the app's information —
macro chips, legends, captions, microcopy — lives below 13px, much of it in `--muted`
gray. On the light theme, `--muted` (#64748b) on `--bg` (#e8ecf3) is right at the AA
boundary, and the olive accent (#859900) on white measures ~3.2:1 — below the 4.5:1
required for normal-size text, which matters because kcal values on every food card are
rendered in it.

**Direction:** adopt a small tokenized scale (e.g. 12 / 13 / 15 / 17 / 20 / 24) and
migrate by find-and-replace tiers rather than redesign. Set a floor: nothing
informational below 12px. Verify accent-on-surface and muted-on-bg pairs with a contrast
checker; darken light-theme olive (e.g. toward #6b7a00) or reserve it for large/bold
text only. Also keep inputs ≥16px to avoid iOS auto-zoom.

## P2 — High-value improvements

### 4. The Log hero asks the user to reconcile five numbers and three palettes

Consumed (+1643, macro-colored ring), Burned (−3151, expenditure-colored ring), Balance
(−1507, red ring, with "1122 below plan" nested inside), plus the deficit math in the
text below. Three adjacent donuts each use a different color system (macros /
BMR-baseline-exercise / status), with no legend on screen. The signed numbers duplicate
what the labels already say, and the signs flip meaning between rings.

**Direction:** pick one hero number — "remaining to eat today" is the classic for good
reason — and render it large in a single ring. Demote Consumed/Burned to a compact row;
put the macro and expenditure breakdowns one tap away. Drop the +/− signs; the labels
carry direction.

### 5. Trends has three overlapping navigation systems

Chevrons (‹ ›), zoom steppers (− +), seven range presets, *and* a mini-map scrubber —
eleven controls wrapping onto two rows before any chart appears. The scrubber's handles
also render clipped at the right edge.

**Direction:** keep the presets and the scrubber (or presets + drag/pinch on the chart
itself, since `TrendGestureSurface` exists); drop the chevron and zoom chips. One row of
controls, more chart above the fold.

### 6. Series color collision on "Calories by macro"

Carbs bars (#d97706) and the Burned line (orange family) are near-neighbors, adjacent in
the legend, and overlapping in the plot. The dashed "intake target" label also collides
with the trend-line label area.

**Direction:** move Burned to a hue no macro uses (the teal `--exp-baseline` family, or
a neutral), and nudge labels apart. A five-series legend under a dense chart is at the
limit — consider making Burned and Trend toggleable.

### 7. Header real estate and Sign out

Every screen spends its top bar on the static app name plus a permanent "Sign out"
button — the most dangerous common action, promoted app-wide. Meanwhile page identity
lives only in the tab bar.

**Direction:** contextual header title (page name or date), move Sign out into the
existing `SettingsMenu` behind the gear.

### 8. Quick-add microcopy is insider shorthand

"0.9x 1 bowl ↺ 576x" packs multiplier, unit, and log-count into a string only its author
can read confidently. The check-in-circle quick-add works, but olive kcal text next to a
green check button gives two competing "go" signals per card.

**Direction:** spell the count ("logged 576×" in the muted row, or drop it — its main
job is ranking, which the sort order already expresses). Keep kcal in `--text` weight
rather than accent so the check button is the only action-colored element.

## P3 — Polish

- **Emoji in functional chrome.** Full-color emoji work beautifully for food identity but
  muddy functional controls — the color camera emoji inside the olive "Add photo" button
  and the four tab-bar emoji at different visual weights read slightly off. Consider
  monochrome glyphs for chrome, emoji for content.
- **Body card delete affordance.** The bare "×" that deletes a body log sits unlabeled
  next to the attachment icon at the top of the Log. Give destructive actions distance
  or a confirm.
- **Guide page affordances.** The "Find servings with staying power" card looks tappable
  but has no CTA or chevron; the "LOSS" eyebrow is blunt to the point of ambiguity
  ("FOR WEIGHT LOSS" or similar reads better). The page mixes an explainer, a tool, and
  a ranked list — an eyebrow-per-purpose is fine, but each card should signal whether it
  is readable or pressable.
- **Trends expand icon** overlaps the tab bar / "Goals" label at the bottom of the
  screenshot — check z-index/safe-area placement.
- **Staying power legend is stated twice** on the Log (right-aligned text and the chip
  legend below the bar). Once is enough.
- **Modal dismissal.** The composer's only exit is the top-right ×; on a phone that's
  the hardest corner to reach. Swipe-down-to-dismiss or a bottom-anchored cancel would
  match the sheet metaphor.

## Suggested sequencing

1. Semantic status tokens + recolor Balance ring and Energy-balance bars (P1.1) — small
   CSS/logic change, biggest perception shift.
2. Collapse the Log plan summary into one neutral callout (P1.2).
3. Type-scale tokens and contrast fixes (P1.3) — mechanical but broad; do it before new
   screens multiply the size count further.
4. Log hero simplification (P2.4) — the only item here that needs real product thought;
   worth a quick mock before code.
5. Trends control diet and series recolor (P2.5–6), header cleanup (P2.7), then P3 polish
   as touched.

## Status — July 12, 2026

P1.1 shipped: the Balance dial now judges today's *projected* end-of-day balance
(`projectedBalanceKcal` in `web/src/lib/energy.ts` — intake = max(consumed, target)), shows a
shaded ±150 kcal "on plan" zone around the top tick, and `balanceColor()` is direction-aware
(green → red above plan, green → blue for a steeper-than-goal deficit). The Trends
energy-balance bars share the new ramp, their caption explains the three states, and the
Cumulative line switched to a neutral stroke so the blue bars can't camouflage it. The dial
popover ledger now shows so-far, stop-eating-now, projected, and plan-balance rows for
today, and the dial states the plan balance it judges against ("plan −385 kcal") directly
under its label so the distance readout ("829 above plan") has a visible reference point. Separately,
Simple view became the default for new users (`DEFAULT_SIMPLE_VIEW` in
`web/src/lib/viewMode.ts`); Detailed is the opt-in enthusiast view.

P1.2 shipped: the plan summary is now one status line ("Eating your 2100 kcal target ≈ lose
0.5 kg/wk · goal: lose 0.3 kg/wk") plus one action line in a neutral color. The recommended
intake is quoted as its stable base (BMR + baseline + goal balance) "plus what you burn in
exercise or steps" — the old single total was computed from today's logged burn, so it
lowballed mornings and drifted up as workouts landed.

Still open: P1.3, P2.4–P2.8, P3. Known nuance:
the Trends chart still plots *today's* bar from the running so-far balance, so an incomplete
day can read as a deep-deficit blue bar until evening.
