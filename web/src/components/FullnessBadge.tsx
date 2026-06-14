import { fullnessFactor, fullnessTier, isBeverageForFullness, FULLNESS_LABELS, type FullnessInput, type FullnessTier } from '../lib/fullness'

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
  /** Tooltip override; defaults to a generic "Fullness factor N / 5". */
  title?: string
}

/** Colored fullness-tier pill for an already-computed score. */
export function FullnessPill({ score, variant = 'full', title }: PillProps) {
  const tier = fullnessTier(score)
  return (
    <span className={`fullness ${TIER_CLASS[tier]}`} title={title ?? `Fullness factor ${score.toFixed(1)} / 5`}>
      {FULLNESS_LABELS[tier]}
      {variant === 'full' && <span className="fullness__value"> · {score.toFixed(1)}/5</span>}
    </span>
  )
}

interface Props {
  food: FullnessInput
  variant?: 'compact' | 'full'
}

/** Fullness-factor pill for a single food. Renders nothing when the food can't be scored. */
export function FullnessBadge({ food, variant = 'full' }: Props) {
  const f = fullnessFactor(food)
  if (!f) return null
  const title = isBeverageForFullness(food)
    ? `Fullness factor ${f.score.toFixed(1)} / 5 — capped: liquid calories are far less filling`
    : `Fullness factor ${f.score.toFixed(1)} / 5 (per 100g)`
  return <FullnessPill score={f.score} variant={variant} title={title} />
}
