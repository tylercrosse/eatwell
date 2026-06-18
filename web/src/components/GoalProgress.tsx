import { useChartColors } from '../lib/theme'

// Progress toward each goal on the metric's own scale (x = weight / body fat, not date). Takes
// display-ready numbers (already converted to the active weight unit) computed on the Trends page.

export interface GoalMetric {
  key: string
  label: string
  unit: string // 'kg' | 'lb' | '%'
  start: number
  now: number
  goal: number
  predicted?: number | null // where the energy-balance line lands; weight only
  nowLabel?: string // what `now` represents, e.g. 'trend' for the smoothed weight (default 'now')
  nowHint?: string // tooltip explaining how `now` is derived
}

/** Signed fraction of the way from start → goal (1 = at goal, <0 = moved the wrong way). */
function frac(m: { start: number; now: number; goal: number }): number {
  if (m.goal === m.start) return m.now === m.goal ? 1 : 0
  return (m.now - m.start) / (m.goal - m.start)
}
const pct = (f: number) => Math.round(f * 100)
const clampPct = (f: number) => Math.min(Math.max(f, 0), 1) * 100
const fmtVal = (v: number, unit: string) => (unit === '%' ? `${v}%` : `${v} ${unit}`)
/** Signed change from start → now, e.g. "−5.1 lb" / "+0.4%". */
function fmtDelta(start: number, now: number, unit: string): string {
  const d = Math.round((now - start) * 10) / 10
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  return `${sign}${fmtVal(Math.abs(d), unit)}`
}

export function GoalProgressTrack({ metrics }: { metrics: GoalMetric[] }) {
  const C = useChartColors()
  if (!metrics.length) {
    return <p className="muted chart-card__empty">Set a goal weight or body fat in Goals, then log a weigh-in.</p>
  }
  const anyPredicted = metrics.some((m) => m.predicted != null)
  return (
    <div className="goal-tracks">
      {metrics.map((m) => {
        const f = frac(m)
        const predFrac = m.predicted != null ? frac({ start: m.start, now: m.predicted, goal: m.goal }) : null
        return (
          <div className="goal-track" key={m.key}>
            <div className="goal-track__head">
              <span className="goal-track__label">{m.label}</span>
              <span className="goal-track__pct">
                <span title={m.nowHint}>
                  {m.nowLabel ?? 'now'} {fmtVal(m.now, m.unit)}
                </span>{' '}
                <span className="goal-track__delta">{fmtDelta(m.start, m.now, m.unit)}</span> · {pct(f)}% there
                {predFrac != null && (
                  <>
                    {' '}·{' '}
                    <span style={{ color: C.projection }}>
                      predicted {fmtVal(m.predicted as number, m.unit)} ({pct(predFrac)}%)
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="goal-track__rail">
              <div className="goal-track__fill" style={{ width: `${clampPct(f)}%` }} />
              {predFrac != null && (
                <span
                  className="goal-track__marker"
                  style={{ left: `${clampPct(predFrac)}%`, background: C.projection }}
                  title={`predicted ${fmtVal(m.predicted as number, m.unit)} (${pct(predFrac)}%)`}
                />
              )}
            </div>
            <div className="goal-track__scale">
              <span>{fmtVal(m.start, m.unit)} start</span>
              <span>{fmtVal(m.goal, m.unit)} goal</span>
            </div>
          </div>
        )
      })}
      {anyPredicted && (
        <p className="chart-card__note">
          <span className="goal-key__swatch" style={{ background: C.projection }} /> predicted pace (from your energy balance)
        </p>
      )}
    </div>
  )
}
