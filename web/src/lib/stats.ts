// Small time-series helpers for the trend charts.

import { daysBetween } from './date'

/** Trailing simple moving average over `window` points. Same length; null until full. */
export function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += values[j]
    return sum / window
  })
}

/**
 * Exponential moving average over an ordered series (smooths noisy scale weight).
 * `alpha` in (0, 1] — higher tracks recent values faster. Same length.
 */
export function ema(values: number[], alpha: number): number[] {
  const out: number[] = []
  values.forEach((v, i) => {
    out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1])
  })
  return out
}

/**
 * Time-aware EMA over dated samples. `alpha` is the per-day weight on a new reading; across a
 * gap of Δ days the prior trend decays geometrically, so the effective weight on the new value
 * is `1 - (1 - alpha)^Δ` (→ 1 across a long gap, where the stale trend is all but forgotten).
 * Samples must be ascending by date. Same length as the input.
 *
 * This is what keeps an isolated old weigh-in from blending with a recent cluster as if the two
 * were adjacent days — the plain `ema` above treats every sample as one step regardless of time.
 */
export function emaByDate(samples: { date: string; value: number }[], alpha: number): number[] {
  const out: number[] = []
  samples.forEach((s, i) => {
    if (i === 0) {
      out.push(s.value)
      return
    }
    const gap = Math.max(1, daysBetween(samples[i - 1].date, s.date))
    const a = 1 - Math.pow(1 - alpha, gap)
    out.push(a * s.value + (1 - a) * out[i - 1])
  })
  return out
}

/** Linear values across a daily axis between dated samples; null before the first and after the last. */
export function interpolateByDate(samples: { date: string; value: number }[], axis: string[]): (number | null)[] {
  if (samples.length === 0) return axis.map(() => null)
  let sampleIndex = 0
  return axis.map((day) => {
    while (sampleIndex < samples.length - 1 && samples[sampleIndex + 1].date < day) sampleIndex += 1

    const current = samples[sampleIndex]
    if (current.date === day) return current.value

    const next = samples[sampleIndex + 1]
    if (!next || current.date > day || next.date < day) return null

    const span = daysBetween(current.date, next.date)
    if (span <= 0) return current.value
    const offset = daysBetween(current.date, day)
    return current.value + ((next.value - current.value) * offset) / span
  })
}
