// Fullness Factor: a 0.5–5.0 satiety estimate (the reverse-engineered nutritiondata.self.com
// formula). Protein and fiber push fullness up; energy density and fat pull it down — so it
// captures "eat more, feel fuller, for fewer calories" better than raw calorie density did.
// Scored per-100g (a property of the food, not the portion), so it needs a weight to normalize.

export type FullnessTier = 'very-filling' | 'filling' | 'moderate' | 'light' | 'low'

export interface Fullness {
  score: number // 0.5–5.0
  tier: FullnessTier
}

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v))

// FF cutoffs: ≥4 very filling, ≥3 filling, ≥2 moderate, ≥1.5 light, else low fullness.
export function fullnessTier(score: number): FullnessTier {
  if (score >= 4) return 'very-filling'
  if (score >= 3) return 'filling'
  if (score >= 2) return 'moderate'
  if (score >= 1.5) return 'light'
  return 'low'
}

export interface FullnessInput {
  food_name?: string | null
  name?: string | null
  calories: number
  protein_g: number
  fat_g: number
  fiber_g?: number | null
  weight_g?: number | null
  is_beverage?: boolean | null
}

// Liquid calories barely satiate (they bypass the stretch/chew signals and empty fast), yet the
// formula rewards their high water content. So drinks are capped at the bottom of the scale —
// 1.4 lands in the "low" tier — regardless of what the raw equation produces.
const BEVERAGE_FF_CAP = 1.4

/** True when a food should use the low-fullness drink cap. User-reviewed data is authoritative;
 * beta/legacy rows should be cleaned in the DB instead of guessed from names at runtime. */
export function isBeverageForFullness(food: FullnessInput): boolean {
  return food.is_beverage === true
}

/** The FF formula broken into its named terms (per-100g), so the score can be *explained* rather
 *  than handed over as a black box. `energy + protein + fiber + fat + base = raw`; `score` is `raw`
 *  clamped to 0.5–5 and then drink-capped. Terms are signed: `fat` is ≤ 0 (a penalty). */
export interface FullnessExplain {
  energy: number // 41.7·cal^-0.7 — the dominant (inverse calorie density) term
  protein: number // 0.05·protein
  fiber: number // 0.000617·fiber³
  fat: number // -0.0000725·fat³ (≤ 0)
  base: number // +0.617 constant
  raw: number // sum of the terms, before clamp/cap
  score: number // final 0.5–5
  beverageCapped: boolean // true when the drink cap actually lowered the score
  per100: { calories: number; protein_g: number; fiber_g: number; fat_g: number }
}

/** Per-term breakdown of the Fullness Factor, or null when the food can't be scored (no usable
 *  weight, or no calories to normalize against). This is the single source of truth for the math —
 *  `fullnessFactor` is a thin wrapper over it. */
export function fullnessExplain(food: FullnessInput): FullnessExplain | null {
  const { calories, protein_g, fat_g, weight_g } = food
  if (!weight_g || weight_g <= 0 || !Number.isFinite(calories) || calories <= 0) return null
  const per100 = 100 / weight_g
  const cal = calories * per100
  const protein = protein_g * per100
  const fat = fat_g * per100
  const fiber = (food.fiber_g ?? 0) * per100
  const energy = 41.7 * cal ** -0.7
  const proteinTerm = 0.05 * protein
  const fiberTerm = 0.000617 * fiber ** 3
  const fatTerm = -0.0000725 * fat ** 3
  const base = 0.617
  const raw = energy + proteinTerm + fiberTerm + fatTerm + base
  const clamped = clamp(0.5, 5, raw)
  const isBev = isBeverageForFullness(food)
  const score = isBev ? Math.min(clamped, BEVERAGE_FF_CAP) : clamped
  return {
    energy,
    protein: proteinTerm,
    fiber: fiberTerm,
    fat: fatTerm,
    base,
    raw,
    score,
    beverageCapped: isBev && clamped > BEVERAGE_FF_CAP,
    per100: { calories: cal, protein_g: protein, fiber_g: fiber, fat_g: fat },
  }
}

/**
 * Fullness Factor for a food, or null when it can't be scored (no usable weight, or no
 * calories to normalize against). Macros are scaled to a per-100g basis before scoring;
 * missing fiber counts as 0 (conservative — slightly understates fullness).
 */
export function fullnessFactor(food: FullnessInput): Fullness | null {
  const ex = fullnessExplain(food)
  if (!ex) return null
  return { score: ex.score, tier: fullnessTier(ex.score) }
}

/** FF scores for a set of foods (unscoreable ones dropped) — the cohort for `fullnessPercentile`. */
export function fullnessScores(foods: FullnessInput[]): number[] {
  return foods.map((f) => fullnessFactor(f)?.score).filter((s): s is number => s != null)
}

/**
 * Where `score` sits within a cohort of scores: the percentage of the cohort it is *more filling
 * than*, ties counted as half (so the median lands near 50). Returns null for an empty cohort.
 * Powers the "more filling than X% of your foods" framing — a *relative* read that's more useful
 * than the absolute tier, since the FF scale compresses most real meals into "moderate".
 */
export function fullnessPercentile(score: number, cohort: number[]): number | null {
  if (cohort.length === 0) return null
  let below = 0
  let equal = 0
  for (const s of cohort) {
    if (s < score) below++
    else if (s === score) equal++
  }
  return Math.round(((below + equal / 2) / cohort.length) * 100)
}

export const FULLNESS_LABELS: Record<FullnessTier, string> = {
  'very-filling': 'Very filling',
  filling: 'Filling',
  moderate: 'Moderate',
  light: 'Light',
  low: 'Low fullness',
}

// Shorter labels for the cramped overview-meter legend.
export const FULLNESS_SHORT: Record<FullnessTier, string> = {
  'very-filling': 'Very filling',
  filling: 'Filling',
  moderate: 'Moderate',
  light: 'Light',
  low: 'Low',
}

// Tiers high → low, for stable ordering in the overview meter + legend.
export const FULLNESS_TIERS: FullnessTier[] = ['very-filling', 'filling', 'moderate', 'light', 'low']

export interface FullnessBreakdown {
  byTier: Record<FullnessTier, number> // calories attributed to each tier
  unknown: number // calories from foods that can't be scored (no usable weight)
  total: number // sum of byTier + unknown
  avgScore: number | null // calorie-weighted mean FF across scored foods (null if none)
  // Weight (g) of items that have one, split by kind. Drinks are kept separate because their
  // mass is liquid volume, not satiating food bulk (1 g ≈ 1 ml).
  foodWeightG: number
  beverageWeightG: number
}

/**
 * Split a set of foods' calories across fullness tiers — each food's calories land in its
 * tier. Unscoreable foods go to `unknown` (surfaced, not silently dropped). Also returns the
 * calorie-weighted mean score across scored foods, a single headline number for the day.
 */
export function fullnessBreakdown(items: FullnessInput[]): FullnessBreakdown {
  const byTier: Record<FullnessTier, number> = {
    'very-filling': 0,
    filling: 0,
    moderate: 0,
    light: 0,
    low: 0,
  }
  let unknown = 0
  let scoreCalSum = 0 // Σ score·cal over scored foods
  let scoredCal = 0 // Σ cal over scored foods
  let foodWeightG = 0
  let beverageWeightG = 0
  for (const it of items) {
    const cals = Number.isFinite(it.calories) ? Math.max(0, it.calories) : 0
    if (it.weight_g && it.weight_g > 0) {
      if (isBeverageForFullness(it)) beverageWeightG += it.weight_g
      else foodWeightG += it.weight_g
    }
    const f = fullnessFactor(it)
    if (f) {
      byTier[f.tier] += cals
      scoreCalSum += f.score * cals
      scoredCal += cals
    } else {
      unknown += cals
    }
  }
  const total = FULLNESS_TIERS.reduce((sum, t) => sum + byTier[t], 0) + unknown
  const avgScore = scoredCal > 0 ? scoreCalSum / scoredCal : null
  return { byTier, unknown, total, avgScore, foodWeightG, beverageWeightG }
}
