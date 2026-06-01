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
