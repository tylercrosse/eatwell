// Body-composition math for the Trends charts. Pure (no React / units) so it can be
// unit-tested and reused. Masses are in kilograms; the page converts to the display unit.
//
// Body fat % alone hides what's actually changing: the same scale weight can be more fat and
// less muscle, or the reverse. Splitting weight into fat mass and lean (fat-free) mass makes
// that visible, and lets the body-fat forecast be *derived* from the energy-balance weight
// forecast instead of drifting to its goal independently of it.

/** Fat-free mass (kg): the part of body weight that isn't fat. */
export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100)
}

/** Fat mass (kg). leanMassKg + fatMassKg === weightKg. */
export function fatMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (bodyFatPct / 100)
}

/**
 * Body fat % implied by a weight and fat mass, clamped to [0, 100]. Null when weight is
 * non-positive (no meaningful percentage to report).
 */
export function bodyFatPctFromMass(weightKg: number, fatKg: number): number | null {
  if (weightKg <= 0) return null
  const pct = (fatKg / weightKg) * 100
  return Math.min(100, Math.max(0, pct))
}

export interface PredictBodyFatInput {
  /** Predicted weight (kg) per axis day, e.g. from `predictWeightSeries`; null before the anchor. */
  predWeightKg: (number | null)[]
  /** Fat-free mass (kg) held constant across the forecast — the "all change is fat" assumption. */
  leanKg: number
}

/**
 * Predicted body fat % per axis day, derived from the predicted-weight series by holding lean
 * mass constant: every kg the forecast adds or removes is treated as fat, so fat mass =
 * predicted weight − lean, and BF% = fat / weight. This ties the body-fat forecast to the
 * energy-balance weight forecast (lose weight → lose fat → BF falls). Null wherever the
 * predicted weight is null.
 */
export function predictBodyFatSeries(input: PredictBodyFatInput): (number | null)[] {
  const { predWeightKg, leanKg } = input
  return predWeightKg.map((w) => (w == null ? null : bodyFatPctFromMass(w, w - leanKg)))
}
