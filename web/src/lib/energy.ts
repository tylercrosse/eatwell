import type { Entry } from '../types'
import type { MacroTotals } from './totals'
import { ATWATER } from './targets'
import { mifflinStJeorBmr, KCAL_PER_KG } from './tdee'

// ---- Expenditure: BMR + baseline activity + exercise (Cronometer-style) ----

export interface ExpenditureBreakdown {
  bmr: number
  baseline: number // non-exercise activity implied by the activity factor
  exercise: number // logged exercise + step-derived burn
  total: number
}

export interface ExpenditureInputs {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  birthYear: number | null | undefined
  sex: string | null | undefined
  activityFactor: number | null | undefined
  exerciseKcal: number // logged exercise + step-derived burn for the day
  currentYear: number
}

/**
 * A day's total energy expenditure split into BMR / baseline activity / exercise. Returns null when
 * the profile is incomplete — same guard as `staticTdee`: without weight, height, birth year and sex
 * we can't compute BMR, so the caller falls back to the simpler Consumed/Remaining view.
 *
 * `baseline = bmr * (activityFactor - 1)` is the NEAT implied by the chosen activity factor. Caveat:
 * a high activity factor already bakes in some exercise, so adding logged exercise on top can
 * over-count. v1 keeps it simple and additive; an "adjusted baseline" correction is deferred.
 */
export function expenditureBreakdown(p: ExpenditureInputs): ExpenditureBreakdown | null {
  if (!p.weightKg || !p.heightCm || !p.birthYear || (p.sex !== 'male' && p.sex !== 'female')) return null
  const bmr = mifflinStJeorBmr(p.weightKg, p.heightCm, p.currentYear - p.birthYear, p.sex)
  const baseline = bmr * ((p.activityFactor ?? 1.2) - 1)
  const exercise = Math.max(0, p.exerciseKcal)
  return { bmr, baseline, exercise, total: bmr + baseline + exercise }
}

// ---- Consumed: macro → calories (Atwater) ----

export interface MacroEnergy {
  protein: number // kcal
  carbs: number // kcal
  fat: number // kcal
  total: number // sum of the three (Atwater)
  logged: number // totals.calories, for reconciliation
}

/** Per-macro calories via Atwater factors (4/4/9). `total` (the Atwater sum) can differ from
 *  `logged` (the logged calorie total) because of fiber, alcohol, or rounding. */
export function macroEnergy(t: MacroTotals): MacroEnergy {
  const protein = t.protein_g * ATWATER.protein
  const carbs = t.carbs_g * ATWATER.carbs
  const fat = t.fat_g * ATWATER.fat
  return { protein, carbs, fat, total: protein + carbs + fat, logged: t.calories }
}

// ---- Per-food contributions (for the detail popovers) ----

export type ContribKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'

export interface Contributor {
  name: string
  value: number
  pct: number // share of the column total
}

/** Top foods by a numeric field, sorted desc, with each one's % of the day's total for that field.
 *  Entries with a non-positive value are dropped. */
export function topContributors(entries: Entry[], key: ContribKey, limit = 8): Contributor[] {
  const total = entries.reduce((sum, e) => sum + (e[key] || 0), 0)
  return entries
    .filter((e) => (e[key] || 0) > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, limit)
    .map((e) => ({ name: e.food_name, value: e[key], pct: total > 0 ? (e[key] / total) * 100 : 0 }))
}

// ---- Balance: energy deficit/surplus as a weekly weight rate ----

export interface BalanceProjection {
  kcalPerDay: number // signed: < 0 deficit (losing), > 0 surplus (gaining)
  weeklyKg: number // kcalPerDay * 7 / KCAL_PER_KG
  basis: 'projected' | 'actual'
  goalWeeklyKg: number | null
}

export interface BalanceInputs {
  expenditureTotal: number
  consumed: number
  calorieTarget: number
  isToday: boolean
  goalWeeklyRateKg: number | null | undefined
}

/**
 * Energy balance expressed as a weekly weight rate. For *today* we project against the calorie
 * target (intake is lumpy and incomplete, while expenditure accrues smoothly all day), so the number
 * is stable through the day. For a *finished* day we use the realized intake. `KCAL_PER_KG` (7700)
 * converts kcal/day to kg/week. Sign matches `weekly_rate_kg`: negative = loss.
 */
export function balanceProjection(p: BalanceInputs): BalanceProjection {
  const intake = p.isToday ? p.calorieTarget : p.consumed
  const kcalPerDay = intake - p.expenditureTotal
  return {
    kcalPerDay,
    weeklyKg: (kcalPerDay * 7) / KCAL_PER_KG,
    basis: p.isToday ? 'projected' : 'actual',
    goalWeeklyKg: p.goalWeeklyRateKg ?? null,
  }
}

/**
 * Signed gap between the day's energy balance and the goal balance, in kcal/day. Negative = a
 * steeper deficit than the goal; positive = shallower deficit / more surplus than the goal. `null`
 * when no goal rate is set (a goal of 0 = maintenance, measured against a zero balance). The
 * recommended intake to hit the goal is `calorieTarget − goalGapKcal`.
 */
export function goalGapKcal(bp: BalanceProjection): number | null {
  if (bp.goalWeeklyKg == null) return null
  const goalKcal = (bp.goalWeeklyKg * KCAL_PER_KG) / 7
  return bp.kcalPerDay - goalKcal
}
