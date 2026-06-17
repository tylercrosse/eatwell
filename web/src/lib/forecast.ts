// Weight forecasting for the Trends charts. Pure (no React / units) so it can be unit-tested
// and reused. Everything here is in kilograms; the page converts to the display unit.

import { KCAL_PER_KG } from './tdee'
import { daysBetween } from './date'

export interface PredictWeightInput {
  /** Ascending day keys to produce a value for (the chart's x-axis). */
  axis: string[]
  /** Smoothed weight (kg) at the most recent weigh-in — the single "where you are now" point. */
  anchorKg: number
  /** Day key of that most recent weigh-in. */
  anchorDate: string
  /** "Now"; days after this are extrapolated at `avgDailyKg`. */
  todayKey: string
  /** Logged daily net kcal (consumed − burned), keyed by day. Only logged days are present. */
  netByDay: Map<string, number>
  /** Average daily weight change (kg/day) used to extrapolate beyond today. */
  avgDailyKg: number
  /** Goal weight (kg); the future projection is clamped so it doesn't overshoot it. */
  goalKg?: number | null
  /** Sign of (goal − current): -1 losing, +1 gaining, 0 no goal / already there. */
  dir?: number
}

/**
 * Predicted weight (kg) per axis day, anchored at the most recent weigh-in and projected
 * **forward only**:
 *  - before the anchor → null (we don't redraw history; actual weigh-ins already show it),
 *  - anchor..today     → anchor + running energy balance accrued since the anchor (Σ net / 7700),
 *  - after today       → continue at the recent average daily balance, clamped at the goal.
 *
 * Net accrued since the anchor is summed over the loaded `netByDay`; if the anchor predates the
 * axis, accumulation simply begins at the first axis day (the unloaded pre-axis net is ignored).
 */
export function predictWeightSeries(input: PredictWeightInput): (number | null)[] {
  const { axis, anchorKg, anchorDate, todayKey, netByDay, avgDailyKg, goalKg = null, dir = 0 } = input
  const clampGoal = (raw: number): number => {
    if (dir === 0 || goalKg == null) return raw
    return dir < 0 ? Math.max(goalKg, raw) : Math.min(goalKg, raw)
  }

  const out: (number | null)[] = []
  let cumKcal = 0 // running net energy balance since the anchor (frozen once we pass today)
  for (const dk of axis) {
    if (dk < anchorDate) {
      out.push(null)
      continue
    }
    if (dk > anchorDate && dk <= todayKey) cumKcal += netByDay.get(dk) ?? 0
    const predNowKg = anchorKg + cumKcal / KCAL_PER_KG
    if (dk <= todayKey) {
      out.push(predNowKg)
    } else {
      out.push(clampGoal(predNowKg + avgDailyKg * daysBetween(todayKey, dk)))
    }
  }
  return out
}

export interface BandOptions {
  /** Day-to-day weight noise floor (kg): the band is never tighter than this. */
  dayNoiseKg?: number
  /** Assumed systematic logging/BMR bias (kcal/day) — the part that does NOT cancel over time. */
  biasKcalPerDay?: number
  /** Hard cap (kg) so a long horizon doesn't draw an absurd cone. */
  capKg?: number
}

/**
 * Half-width (kg) of the forecast uncertainty band `t` days into the future: a daily-noise floor
 * plus a term that grows with a presumed systematic bias in the energy balance. This is a
 * deliberate heuristic — once enough daily weigh-ins exist we can estimate the user's own daily
 * σ from trend residuals and widen as √t instead (see docs/BACKLOG.md).
 */
export function bandHalfWidthKg(t: number, opts: BandOptions = {}): number {
  const { dayNoiseKg = 0.7, biasKcalPerDay = 150, capKg = 6 } = opts
  const w = dayNoiseKg + (biasKcalPerDay / KCAL_PER_KG) * Math.max(0, t)
  return Math.min(capKg, w)
}
