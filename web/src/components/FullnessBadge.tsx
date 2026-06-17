import {
  fullnessExplain,
  fullnessFactor,
  fullnessPercentile,
  fullnessTier,
  isBeverageForFullness,
  FULLNESS_LABELS,
  type FullnessInput,
  type FullnessTier,
} from '../lib/fullness'
import { Popover } from './Popover'

const TIER_CLASS: Record<FullnessTier, string> = {
  'very-filling': 'fullness--very-filling',
  filling: 'fullness--filling',
  moderate: 'fullness--moderate',
  light: 'fullness--light',
  low: 'fullness--low',
}

interface PillProps {
  score: number // 0.5–5
  /** Compact form shows just the colored label (for tight rows); full adds the /5 score. */
  variant?: 'compact' | 'full'
  /** Tooltip override; defaults to a generic "Filling per calorie N / 5". */
  title?: string
}

/** Colored fullness-tier pill for an already-computed score. */
export function FullnessPill({ score, variant = 'full', title }: PillProps) {
  const tier = fullnessTier(score)
  return (
    <span className={`fullness ${TIER_CLASS[tier]}`} title={title ?? `Filling per calorie ${score.toFixed(1)} / 5`}>
      {FULLNESS_LABELS[tier]}
      {variant === 'full' && <span className="fullness__value"> · {score.toFixed(1)}/5</span>}
    </span>
  )
}

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`
const fmtDensity = (v: number, unit: string) => `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${unit}/100g`

/** Popover content: the FF score broken into its drivers + a relative read against your own foods. */
function FullnessExplainer({ food, cohort }: { food: FullnessInput; cohort?: number[] }) {
  const ex = fullnessExplain(food)
  if (!ex) return null
  const pct = cohort && cohort.length > 0 ? fullnessPercentile(ex.score, cohort) : null
  const rows = [
    { label: 'Calorie density', detail: fmtDensity(ex.per100.calories, 'kcal'), value: ex.energy, color: 'var(--energy)' },
    { label: 'Protein', detail: fmtDensity(ex.per100.protein_g, 'g'), value: ex.protein, color: 'var(--macro-protein)' },
    { label: 'Fat', detail: fmtDensity(ex.per100.fat_g, 'g'), value: ex.fat, color: 'var(--macro-fat)' },
    { label: 'Fiber', detail: fmtDensity(ex.per100.fiber_g, 'g'), value: ex.fiber, color: 'var(--macro-fiber)' },
    { label: 'Base', detail: 'formula constant', value: ex.base, color: 'var(--surface-2)' },
  ]
  // Terms sum to the *raw* score; it's then clamped to 0.5–5 (and drink-capped).
  const clamped = Math.abs(ex.raw - ex.score) > 0.05 && !ex.beverageCapped
  return (
    <div>
      <div className="popover__title">Filling per calorie {ex.score.toFixed(1)} / 5</div>
      <div className="contrib-table contrib-table--terms">
        {rows.map((r) => (
          <div className="contrib-table__row" key={r.label}>
            <span className="contrib-table__name contrib-table__name--detail">
              <span className="contrib-table__dot" style={{ background: r.color }} />
              <span className="contrib-table__text">
                <span>{r.label}</span>
                <span className="contrib-table__detail">{r.detail}</span>
              </span>
            </span>
            <span className="contrib-table__val">{signed(r.value)}</span>
          </div>
        ))}
      </div>
      {pct != null && <p className="popover__note">More filling than {pct}% of your recent foods.</p>}
      {ex.beverageCapped && <p className="popover__note">Capped at 1.4 — liquid calories are far less filling.</p>}
      {clamped && <p className="popover__note">Clamped to the 0.5–5 scale.</p>}
      <p className="popover__note">
        This is a per-100g efficiency score, not a meal-size estimate. Calorie density dominates, so high-volume foods
        score highest.
      </p>
    </div>
  )
}

interface Props {
  food: FullnessInput
  variant?: 'compact' | 'full'
  /** When true, the pill is tappable and opens a popover breaking down how the score is built. */
  explain?: boolean
  /** Recent-food FF scores — powers the "more filling than X% of your foods" line in the popover. */
  cohort?: number[]
}

/** Fullness-factor pill for a single food. Renders nothing when the food can't be scored. */
export function FullnessBadge({ food, variant = 'full', explain = false, cohort }: Props) {
  const f = fullnessFactor(food)
  if (!f) return null
  const title = isBeverageForFullness(food)
    ? `Filling per calorie ${f.score.toFixed(1)} / 5 — capped: liquid calories are far less filling`
    : `Filling per calorie ${f.score.toFixed(1)} / 5 (per 100g)`
  const pill = <FullnessPill score={f.score} variant={variant} title={title} />
  if (!explain) return pill
  return (
    <Popover label="How this per-calorie score is built" content={<FullnessExplainer food={food} cohort={cohort} />}>
      {pill}
    </Popover>
  )
}
