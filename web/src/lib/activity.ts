// Rough step→calorie conversion. Energy per step scales with body weight; this constant
// gives ~320 kcal for 10k steps at 80 kg. It's an estimate, not a measurement.
const STEP_KCAL_PER_KG = 0.0004

/** Approximate calories burned from a day's steps, given that day's weight. 0 if unknown. */
export function stepsToKcal(steps: number | null | undefined, weightKg: number | null | undefined): number {
  if (!steps || !weightKg) return 0
  return steps * weightKg * STEP_KCAL_PER_KG
}
