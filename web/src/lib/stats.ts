// Small time-series helpers for the trend charts.

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
