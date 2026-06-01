// Calorie (energy) density: calories relative to a food's weight. Low-density foods
// (water/fiber rich) let you eat larger, more satisfying portions for fewer calories.
// Band cutoffs follow the common kcal-per-pound scale; we also surface kcal/100g.

const GRAMS_PER_POUND = 453.592

export type DensityBand = 'very-low' | 'low' | 'medium' | 'very-high'

export interface Density {
  per100g: number // kcal per 100 g
  perPound: number // kcal per pound (the scale the bands are defined on)
  band: DensityBand
}

// kcal/lb cutoffs: <400 very low, 400–800 low, 800–1800 medium, >1800 very high.
function bandFor(kcalPerPound: number): DensityBand {
  if (kcalPerPound < 400) return 'very-low'
  if (kcalPerPound < 800) return 'low'
  if (kcalPerPound < 1800) return 'medium'
  return 'very-high'
}

/** Compute calorie density, or null when weight is missing/non-positive (can't divide). */
export function calorieDensity(calories: number, weightG: number | null | undefined): Density | null {
  if (!weightG || weightG <= 0 || !Number.isFinite(calories) || calories < 0) return null
  const perGram = calories / weightG
  const perPound = perGram * GRAMS_PER_POUND
  return { per100g: perGram * 100, perPound, band: bandFor(perPound) }
}

export const DENSITY_LABELS: Record<DensityBand, string> = {
  'very-low': 'Very low density',
  low: 'Low density',
  medium: 'Medium density',
  'very-high': 'Very high density',
}

// Bands low → high, for stable ordering in the overview meter + legend.
export const DENSITY_BANDS: DensityBand[] = ['very-low', 'low', 'medium', 'very-high']

export interface DensityBreakdown {
  byBand: Record<DensityBand, number> // calories attributed to each band
  unknown: number // calories from foods with no usable weight (can't be classified)
  total: number // sum of byBand + unknown
}

/**
 * Split a set of foods' calories across density bands — each food's calories land in
 * the band of its overall density. Foods lacking a weight go to `unknown` (surfaced,
 * not silently dropped). Accepts any {calories, weight_g} shape (e.g. an Entry).
 */
export function densityBreakdown(
  items: { calories: number; weight_g?: number | null }[],
): DensityBreakdown {
  const byBand: Record<DensityBand, number> = { 'very-low': 0, low: 0, medium: 0, 'very-high': 0 }
  let unknown = 0
  for (const it of items) {
    const cals = Number.isFinite(it.calories) ? Math.max(0, it.calories) : 0
    const d = calorieDensity(it.calories, it.weight_g)
    if (d) byBand[d.band] += cals
    else unknown += cals
  }
  const total = DENSITY_BANDS.reduce((sum, b) => sum + byBand[b], 0) + unknown
  return { byBand, unknown, total }
}
