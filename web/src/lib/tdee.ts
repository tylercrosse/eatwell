import { ema } from './stats'
import { daysBetween } from './date'

// ~7700 kcal per kg of body mass — the constant linking energy balance to weight change.
export const KCAL_PER_KG = 7700

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function mifflinStJeorBmr(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

interface ProfileInputs {
  weightKg: number | null
  heightCm: number | null | undefined
  birthYear: number | null | undefined
  sex: string | null | undefined
  activityFactor: number | null | undefined
  currentYear: number
}

/** Static TDEE from the profile (BMR × activity factor), or null if any input is missing. */
export function staticTdee(p: ProfileInputs): number | null {
  if (!p.weightKg || !p.heightCm || !p.birthYear || (p.sex !== 'male' && p.sex !== 'female')) return null
  const bmr = mifflinStJeorBmr(p.weightKg, p.heightCm, p.currentYear - p.birthYear, p.sex)
  return bmr * (p.activityFactor ?? 1.2)
}

/** Calorie target for a goal rate: TDEE plus the weekly weight change spread over the week. */
export function targetForRate(tdee: number, weeklyRateKg: number | null | undefined): number {
  return tdee + ((weeklyRateKg ?? 0) * KCAL_PER_KG) / 7
}

export interface AdaptiveResult {
  tdee: number
  days: number // span between the first and last weigh-in used
  loggedDays: number // days with logged intake in that span
}

/**
 * Data-driven TDEE from energy balance: TDEE = (Σ intake − Δweight·7700) / days, over the
 * span between the first and last (EMA-smoothed) weigh-in. Returns null when there isn't
 * enough data (need ≥7 days span, ≥2 weigh-ins, and reasonably consistent logging).
 */
export function adaptiveTdee(
  entries: ReadonlyArray<{ date: string; total_calories: number }>,
  metrics: ReadonlyArray<{ date: string; weight_kg: number | null }>,
): AdaptiveResult | null {
  const weighed = metrics.filter((m): m is { date: string; weight_kg: number } => m.weight_kg != null)
  if (weighed.length < 2) return null

  const smoothed = ema(weighed.map((m) => m.weight_kg), 0.3)
  const startDate = weighed[0].date
  const endDate = weighed[weighed.length - 1].date
  const days = daysBetween(startDate, endDate)
  if (days < 7) return null

  let sumIntake = 0
  let loggedDays = 0
  for (const e of entries) {
    if (e.date >= startDate && e.date <= endDate && e.total_calories > 0) {
      sumIntake += e.total_calories
      loggedDays += 1
    }
  }
  if (loggedDays < Math.max(5, Math.floor(days * 0.5))) return null // too sparse to trust

  const deltaKg = smoothed[smoothed.length - 1] - smoothed[0]
  return { tdee: (sumIntake - deltaKg * KCAL_PER_KG) / days, days, loggedDays }
}
