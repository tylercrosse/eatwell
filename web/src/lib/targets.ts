import type { Targets } from '../types'

// kcal per gram (Atwater factors). Used to turn a % split into gram targets.
export const ATWATER = { protein: 4, carbs: 4, fat: 9 } as const
export const FIBER_G_PER_1000_KCAL = 14

export const DEFAULT_TARGETS: Targets = {
  calorie_target: 2000,
  protein_pct: 30,
  carbs_pct: 40,
  fat_pct: 30,
}

export interface MacroGramTargets {
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** Derive gram targets from the calorie goal + percent split. */
export function macroGramTargets(t: Targets): MacroGramTargets {
  return {
    protein_g: (t.calorie_target * t.protein_pct) / 100 / ATWATER.protein,
    carbs_g: (t.calorie_target * t.carbs_pct) / 100 / ATWATER.carbs,
    fat_g: (t.calorie_target * t.fat_pct) / 100 / ATWATER.fat,
  }
}

/** Daily fiber goal derived from the calorie target: 14 g per 1,000 kcal. */
export function fiberGramTarget(t: Targets): number {
  return (t.calorie_target / 1000) * FIBER_G_PER_1000_KCAL
}

export type GoalDirection = 'lose' | 'gain' | 'maintain'

/** Direction of the body goal, from goal weight vs current weight (|diff| < 0.1 kg = maintain).
 *  null when either weight is unknown. */
export function goalDirection(
  goalWeightKg: number | null | undefined,
  currentWeightKg: number | null | undefined,
): GoalDirection | null {
  if (goalWeightKg == null || currentWeightKg == null) return null
  const diff = goalWeightKg - currentWeightKg
  if (Math.abs(diff) < 0.1) return 'maintain'
  return diff < 0 ? 'lose' : 'gain'
}

/** The goal's signed weekly rate (kg/wk; negative = loss). The rate is stored as a positive
 *  magnitude, so the sign is inferred from the goal direction (goal vs current weight). Falls back
 *  to the stored value when direction can't be inferred; null when no rate is set. */
export function signedWeeklyRateKg(t: Targets, currentWeightKg: number | null | undefined): number | null {
  if (t.weekly_rate_kg == null) return null
  const mag = Math.abs(t.weekly_rate_kg)
  switch (goalDirection(t.goal_weight_kg, currentWeightKg)) {
    case 'lose':
      return -mag
    case 'gain':
      return mag
    case 'maintain':
      return 0
    default:
      return t.weekly_rate_kg
  }
}

/**
 * Infer the baseline for a goal-progress track from a chronological metric series.
 *
 * Without an explicit "goal started on" date, old history can make the denominator nonsense
 * (for example, an old below-goal weight before a later regain). Use the current goal segment:
 * after the last time the metric was already on the goal side, choose the high-water mark for
 * decrease goals or the low-water mark for increase goals.
 */
export function goalProgressStart(values: number[], now: number, goal: number): number {
  if (now === goal) return goal

  const wantsDecrease = now > goal
  let segmentStart = 0
  values.forEach((value, index) => {
    const alreadyOnGoalSide = wantsDecrease ? value <= goal : value >= goal
    if (alreadyOnGoalSide) segmentStart = index + 1
  })

  const segment = values.slice(segmentStart).filter(Number.isFinite)
  segment.push(now)
  return wantsDecrease ? Math.max(...segment) : Math.min(...segment)
}
