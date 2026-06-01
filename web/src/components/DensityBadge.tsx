import { calorieDensity, DENSITY_LABELS, type DensityBand } from '../lib/density'
import { round } from '../lib/totals'

const BAND_CLASS: Record<DensityBand, string> = {
  'very-low': 'density--very-low',
  low: 'density--low',
  medium: 'density--medium',
  'very-high': 'density--very-high',
}

interface Props {
  calories: number
  weightG: number | null | undefined
  /** Compact form shows just the colored label (for tight rows); full adds kcal/100g. */
  variant?: 'compact' | 'full'
}

/** Calorie-density pill, color-coded by band. Renders nothing without a usable weight. */
export function DensityBadge({ calories, weightG, variant = 'full' }: Props) {
  const d = calorieDensity(calories, weightG)
  if (!d) return null
  return (
    <span
      className={`density ${BAND_CLASS[d.band]}`}
      title={`${round(d.per100g)} kcal/100g · ${round(d.perPound)} kcal/lb`}
    >
      {DENSITY_LABELS[d.band]}
      {variant === 'full' && <span className="density__value"> · {round(d.per100g)} kcal/100g</span>}
    </span>
  )
}
