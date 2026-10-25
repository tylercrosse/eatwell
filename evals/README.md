# Evals

Offline accuracy checks for the AI estimators. Bead: `ct-pm.3`; rationale in
`docs/PRODUCT_MATURITY_ROADMAP.md` Priority 3.

## Food photos (`food_photos/`)

Runs the production photo estimator (`openrouter.analyze_food_image`, the same call
`/api/analyze` makes, on the same normalized JPEG) over a labeled set and scores the totals.

```bash
uv run python scripts/eval_food_photos.py fetch                  # download + sha256-verify images
uv run python scripts/eval_food_photos.py run --label baseline   # all cases, OPENROUTER_MODEL
uv run python scripts/eval_food_photos.py run --model openai/gpt-5-mini --tier nutrition5k
uv run python scripts/eval_food_photos.py compare evals/food_photos/runs/A.json evals/food_photos/runs/B.json
```

`run` filters: `--tier`, `--category`, `--ids a,b`, `--limit N`. Each run writes
`food_photos/runs/<timestamp>_<model>[_label].json` with scores and every per-case prediction;
commit the ones worth diffing against. A full run is 74 vision calls (~4 min at concurrency 4).

### The case set

`food_photos/cases.jsonl` is the source of truth: one case per line with the image URL,
sha256, license and author, the ground truth, and where the truth came from. Images are not
committed; `fetch` caches them in `food_photos/.cache/` (gitignored).

| Tier | n | Ground truth | What it tests |
| --- | --- | --- | --- |
| `nutrition5k` | 62 | Every ingredient weighed (Google's [Nutrition5k](https://github.com/google-research-datasets/Nutrition5k), CC BY 4.0) | Portion size and mixed plates: pizza, salads, protein + starch plates, breakfast |
| `restaurant` | 12 | Published chain nutrition, midpoint where menu years disagree (spread in `truth_source`) | Recognizable restaurant items, single vs double patty, nugget counts |

Nutrition5k cases are a seeded, stratified sample: calorie-quantile bands per category, plus
**portion pairs** (`portion_group`), meaning the same ingredient set at at least 2x the mass. Plates
were hand-reviewed to drop cropped or off-frame food and neighbors' plates in shot.
Restaurant photos are user uploads on Wikimedia Commons (CC0/CC BY/CC BY-SA/PD; attribution in
each case). Scraped Yelp/Google/Instagram photos are out: their terms forbid it and this repo is
public. Packaged foods are out on purpose: barcode scan and label lookup already cover them.

Caveats: Nutrition5k is a single cafeteria's overhead rig (consistent angle and plates, no
restaurant lighting), so it is a portion-size test rather than a realistic-photo test. Restaurant
labels are what the chain publishes, not what was on that plate.

### Metrics

- `calorie_mape` / `calorie_median_ape`: mean / median absolute percent error on total kcal.
- `calorie_bias_pct`: mean signed percent error (positive = overestimates).
- `within_20pct`: share of cases within ±20% of truth.
- `*_g_mae`: macro absolute error in grams; `weight_mape` when the truth has a weight.
- `portion_scaling`: per pair, predicted large/small ratio ÷ true ratio. 1.0 is ideal; below
  1 means the model shrinks every plate toward a "typical serving".
- `failures`: `EstimationError`s (API errors, malformed JSON). Latency p50/p95 per call.
- `cost_per_photo_usd`: the cost OpenRouter actually billed (`usage.cost`), captured by
  wrapping the client inside the eval only; `mean_completion_tokens` includes reasoning tokens.

Runs use the app's own settings (`OPENROUTER_MODEL`, `OPENROUTER_REASONING_EFFORT`);
`--model` and `--reasoning-effort low|medium|high|none` override them for one run.

Not yet measured: user-correction burden (entries don't keep the original AI estimate; ct-pm.2).

### Baseline: 2026-10-25, `google/gemini-3-flash-preview`

| Slice | MAPE | Bias | Within 20% |
| --- | --- | --- | --- |
| Overall (74) | 37.3% | +15.2% | 39% |
| Restaurant (12) | 5.1% | +2.7% | 92% |
| Nutrition5k (62) | 43.5% | +17.6% | 29% |
| Pizza (13) | 53.8% | +51.6% | 31% |
| Salad (18) | 48.6% | +9.0% | 22% |
| Plate (17) | 37.6% | +18.1% | 24% |

Median portion scaling **0.49**: when the food grows 3x, the estimate grows about 1.5x. One salad pair
was estimated *lower* for the larger plate. Small plates (<200 kcal) are overestimated by
+29% on average; large ones (≥400 kcal) are about right (−3%). Restaurant items are near-perfect
because the model recognizes them and recalls the published numbers. The one miss was the
12-count nuggets (510 vs 375 kcal), where it had to count. Zero parse failures; p50 latency 2.7 s.

Takeaway: named restaurant items are a recall test; the real weakness is portion size on
unbranded prepared food. That is where prompt work (e.g. ct-m6.4) should be measured.

### Model comparison: 2026-10-25, current prompt

| Model | N5k MAPE | N5k bias | Pizza | Salad | Restaurant | Scaling | $/photo | p50 / p95 s | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini-3.8-flash | **30.9%** | +1% | 28% | 39% | 3.7% | 0.60 | $0.0060 | 7.5 / 17.4 | 0 |
| gemini-3.8-flash, effort low | 31.4% | +2% | 30% | 42% | 5.1% | 0.57 | $0.0034 | 4.2 / 15.0 | 0 |
| gemini-3.7-flash | 34.2% | −5% | 28% | 40% | 4.2% | 0.56 | $0.0053 | 7.1 / 12.6 | 0 |
| gemini-3.5-flash-lite | 40.2% | +14% | 42% | 63% | 5.1% | 0.72 | $0.0016 | 1.7 / 3.8 | 0 |
| gemini-3-flash-preview (current) | 42.7–43.5% | +18% | 50–54% | 49–60% | 5.1% | 0.49–0.56 | $0.0021 | 2.7 / 5.4 | 0 |
| qwen3.8-flash | 49.8% | +27% | 51% | 58% | 25.5% | 0.65 | $0.0009 | 14.4 / 50.3 | 14 |
| gpt-5.4-mini | 53.5% | +40% | 55% | 62% | 20.9% | 0.58 | $0.0020 | 2.0 / 4.8 | 0 |
| claude-haiku-5.5 | 73.6% | +65% | 81% | 76% | 30.0% | 0.71 | $0.0005 | 3.9 / 7.9 | 0 |
| gpt-5.6-luna | 98.2% | +90% | 109% | 116% | 56.8% | 0.52 | $0.0008 | 4.9 / 7.3 | 0 |

Two runs of the current model differed by about 1 point of N5k MAPE, so gaps of several points
are real; per-category numbers (n = 13–18) are noisier. Scaling is measured on 11 pairs only.
Non-Gemini models overestimate heavily and also miss the chain items. Qwen's 14 failures were
schema violations. This matches the 2026 Nutrition5k VLM benchmark
([bioRxiv 2026.07.26.740845](https://www.biorxiv.org/content/10.64898/2026.07.26.740845v1)),
where the Gemini Flash line led on calories.

### Adding cases

Append a line to `cases.jsonl` with `tier: "local"` for your own photos: weigh the plate or use
a known recipe and record how in `truth_source`. Real meals out are the most valuable additions.
For photos that aren't hosted anywhere, copy the file to `.cache/<sha256>.img` and leave
`image.url` empty; `fetch` skips anything already cached. Don't commit personal photos.
