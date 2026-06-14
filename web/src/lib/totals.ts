import type { Entry } from '../types'

export interface MacroTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fiber_g: number
  fat_g: number
}

/** Pure: sum calories + macros across a day's entries. */
export function sumTotals(entries: Entry[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein_g: acc.protein_g + e.protein_g,
      carbs_g: acc.carbs_g + e.carbs_g,
      fiber_g: acc.fiber_g + (e.fiber_g ?? 0),
      fat_g: acc.fat_g + e.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fiber_g: 0, fat_g: 0 },
  )
}

export function round(n: number): number {
  return Math.round(n)
}

/** Round to 1 decimal place (e.g. weights/body-fat display). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Compact food-weight label: grams under 1 kg, else kg to 1 dp (e.g. "350 g", "1.4 kg"). */
export function formatFoodWeight(grams: number): string {
  return grams >= 1000 ? `${round1(grams / 1000)} kg` : `${round(grams)} g`
}

/** Drink-volume label (1 g ≈ 1 ml): millilitres under 1 L, else litres to 1 dp ("250 ml", "0.5 L"). */
export function formatDrinkVolume(grams: number): string {
  return grams >= 1000 ? `${round1(grams / 1000)} L` : `${round(grams)} ml`
}
