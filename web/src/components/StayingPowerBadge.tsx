import {
  STAYING_POWER_LABELS,
  type MealStayingPower,
  type StayingPowerTier,
} from '../lib/stayingPower'
import { Popover } from './Popover'
import { StayingPowerExplainer } from './StayingPowerExplainer'

const TIER_CLASS: Record<StayingPowerTier, string> = {
  strong: 'staying-power--strong',
  solid: 'staying-power--solid',
  moderate: 'staying-power--moderate',
  light: 'staying-power--light',
}

interface PillProps {
  power: MealStayingPower
  variant?: 'compact' | 'full'
}

export function StayingPowerPill({ power, variant = 'full' }: PillProps) {
  const label = STAYING_POWER_LABELS[power.tier]
  return (
    <span className={`staying-power ${TIER_CLASS[power.tier]}`} title={`${label} staying power`}>
      {label}
      {variant === 'full' && <span className="staying-power__suffix"> staying power</span>}
    </span>
  )
}

interface Props {
  power: MealStayingPower
  variant?: 'compact' | 'full'
  explain?: boolean
}

export function StayingPowerBadge({ power, variant = 'full', explain = false }: Props) {
  const pill = <StayingPowerPill power={power} variant={variant} />
  if (!explain) return pill
  return (
    <Popover
      label="Why this meal may be filling"
      content={
        <StayingPowerExplainer
          power={power}
          title={`${STAYING_POWER_LABELS[power.tier]} staying power`}
          scope="meal"
        />
      }
    >
      {pill}
    </Popover>
  )
}
