import type { MacroTotals } from '../lib/totals'
import { round } from '../lib/totals'
import { macroGramTargets } from '../lib/targets'
import type { Targets } from '../types'

interface Props {
  totals: MacroTotals
  targets: Targets
}

/** Calorie rings (Consumed + Remaining) + macro progress bars, against daily targets. */
export function EnergySummary({ totals, targets }: Props) {
  const grams = macroGramTargets(targets)
  const target = targets.calorie_target
  const consumed = totals.calories
  const remaining = target - consumed
  const consumedFrac = target > 0 ? consumed / target : 0

  return (
    <div className="card energy-summary">
      <div className="energy-summary__rings">
        <Ring
          label="Consumed"
          value={round(consumed)}
          unit="kcal"
          sub={`${round(consumedFrac * 100)}%`}
          fraction={consumedFrac}
          over={consumedFrac > 1}
        />
        <Ring
          label="Remaining"
          value={round(remaining)}
          unit="kcal"
          fraction={target > 0 ? remaining / target : 0}
          over={remaining < 0}
        />
      </div>

      <div className="energy-summary__bars">
        <MacroBar label="Protein" value={totals.protein_g} target={grams.protein_g} colorVar="--macro-protein" />
        <MacroBar label="Carbs" value={totals.carbs_g} target={grams.carbs_g} colorVar="--macro-carbs" />
        <MacroBar label="Fat" value={totals.fat_g} target={grams.fat_g} colorVar="--macro-fat" />
      </div>
    </div>
  )
}

const RING_SIZE = 120
const RING_STROKE = 12
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R
const RING_CENTER = RING_SIZE / 2

function Ring({
  label,
  value,
  unit,
  sub,
  fraction,
  over,
}: {
  label: string
  value: number
  unit: string
  sub?: string
  fraction: number // 0..1+ ; clamped to the ring for the arc
  over?: boolean
}) {
  const clamped = Math.min(Math.max(fraction, 0), 1)
  const dashoffset = RING_C * (1 - clamped)
  return (
    <div className="energy-ring">
      <div className="energy-ring__chart">
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_R}
            fill="none"
            stroke="var(--border)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_R}
            fill="none"
            stroke={over ? 'var(--danger)' : 'var(--accent)'}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          />
        </svg>
        <div className="energy-ring__center">
          <span className="energy-ring__value">{value}</span>
          <span className="energy-ring__unit">{unit}</span>
          {sub && <span className="energy-ring__sub">{sub}</span>}
        </div>
      </div>
      <span className="energy-ring__label">{label}</span>
    </div>
  )
}

function MacroBar({
  label,
  value,
  target,
  colorVar,
}: {
  label: string
  value: number
  target: number
  colorVar: string
}) {
  const frac = target > 0 ? value / target : 0
  const width = Math.min(Math.max(frac, 0), 1) * 100
  const over = frac > 1
  return (
    <div className="macro-bar">
      <div className="macro-bar__head">
        <span className="macro-bar__label">{label}</span>
        <span className="macro-bar__nums">
          {round(value)} / {round(target)} g · {round(frac * 100)}%
        </span>
      </div>
      <div className="macro-bar__track">
        <div
          className={`macro-bar__fill${over ? ' is-over' : ''}`}
          // Inline color only when on-target; the .is-over class (CSS) wins when over.
          style={{ width: `${width}%`, ...(over ? {} : { background: `var(${colorVar})` }) }}
        />
      </div>
    </div>
  )
}
