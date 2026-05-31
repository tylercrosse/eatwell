import type { Targets } from '../types'

// kcal per gram (Atwater factors). Used to turn a % split into gram targets.
export const ATWATER = { protein: 4, carbs: 4, fat: 9 } as const

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
