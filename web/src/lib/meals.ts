import type { Entry, Meal } from '../types'
import { sumTotals, type MacroTotals } from './totals'

export const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks']

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

/** Default meal bucket from the local hour-of-day. */
export function mealFromTime(d: Date = new Date()): Meal {
  const h = d.getHours()
  if (h >= 4 && h < 11) return 'breakfast'
  if (h >= 11 && h < 15) return 'lunch'
  if (h >= 15 && h < 21) return 'dinner'
  return 'snacks'
}

/** Normalize a stored meal value (null / unknown -> snacks). */
export function bucketOf(meal: string | null): Meal {
  return (MEAL_ORDER as string[]).includes(meal ?? '') ? (meal as Meal) : 'snacks'
}

export interface MealGroup {
  meal: Meal
  entries: Entry[]
  totals: MacroTotals
}

/** Group a day's entries into the four meals (in MEAL_ORDER), with per-meal subtotals. */
export function groupByMeal(entries: Entry[]): MealGroup[] {
  const buckets: Record<Meal, Entry[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] }
  for (const e of entries) buckets[bucketOf(e.meal)].push(e)
  return MEAL_ORDER.map((meal) => ({
    meal,
    entries: buckets[meal],
    totals: sumTotals(buckets[meal]),
  }))
}
