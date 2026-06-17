import { fullnessTier, type FullnessTier } from '../lib/fullness'
import type { MealStayingPower } from '../lib/stayingPower'
import { formatDrinkVolume, formatFoodWeight, round } from '../lib/totals'

const FULLNESS_TIER_COLOR: Record<FullnessTier, string> = {
  'very-filling': 'var(--fullness-very-filling)',
  filling: 'var(--fullness-filling)',
  moderate: 'var(--fullness-moderate)',
  light: 'var(--fullness-light)',
  low: 'var(--fullness-low)',
}

function fmtDensity(value: number | null): string {
  if (value == null) return 'unknown'
  return `${round(value)} kcal/100g`
}

function fmtDrinkDensity(value: number | null): string {
  if (value == null) return 'unknown'
  return `${round(value)} kcal/100ml`
}

function fullnessScoreColor(score: number): string {
  return FULLNESS_TIER_COLOR[fullnessTier(score)]
}

function densityColor(kcalPer100g: number | null): string {
  if (kcalPer100g == null) return 'var(--muted)'
  if (kcalPer100g <= 120) return 'var(--fullness-filling)'
  if (kcalPer100g <= 220) return 'var(--fullness-moderate)'
  if (kcalPer100g <= 320) return 'var(--fullness-light)'
  return 'var(--fullness-low)'
}

interface Props {
  power: MealStayingPower
  title: string
  scope: 'meal' | 'item'
}

export function StayingPowerExplainer({ power, title, scope }: Props) {
  const hasDrink = power.beverageCalories > 0 || power.beverageWeightG > 0
  const hasSolidFood = power.foodWeightG > 0 || power.unknownFoodCalories > 0
  const rows = [
    ...(hasSolidFood
      ? [
          {
            label: 'Food volume',
            value: power.foodWeightG > 0 ? formatFoodWeight(power.foodWeightG) : 'unknown',
            color: power.foodWeightG > 0 ? 'var(--accent)' : 'var(--muted)',
          },
        ]
      : []),
    ...(hasDrink
      ? [
          {
            label: 'Drink volume',
            value: power.beverageWeightG > 0 ? formatDrinkVolume(power.beverageWeightG) : 'unknown',
            color: 'var(--muted)',
          },
        ]
      : []),
    { label: 'Protein', value: `${round(power.protein_g)} g`, color: 'var(--macro-protein)' },
    { label: 'Fiber', value: `${round(power.fiber_g)} g`, color: 'var(--macro-fiber)' },
    { label: 'Calories', value: `${round(power.calories)} kcal`, color: 'var(--muted)' },
    ...(hasSolidFood
      ? [{ label: 'Food density', value: fmtDensity(power.kcalPer100g), color: densityColor(power.kcalPer100g) }]
      : []),
    ...(hasDrink
      ? [
          {
            label: 'Drink density',
            value: fmtDrinkDensity(power.beverageKcalPer100ml),
            color: 'var(--muted)',
          },
        ]
      : []),
    ...(power.fillingPerCalorieScore != null
      ? [
          {
            label: 'Filling per calorie',
            value: `${power.fillingPerCalorieScore.toFixed(1)} / 5`,
            color: fullnessScoreColor(power.fillingPerCalorieScore),
          },
        ]
      : []),
  ]
  return (
    <div>
      <div className="popover__title">{title}</div>
      <div className="contrib-table contrib-table--calc">
        {rows.map((row) => (
          <div className="contrib-table__row" key={row.label}>
            <span className="contrib-table__name">
              <span className="contrib-table__dot" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="contrib-table__val">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="popover__note">
        {scope === 'meal'
          ? 'Portion-based estimate from this logged meal. Food volume, protein, fiber, and enough calories help; high density and drinks pull it down.'
          : 'How this logged item contributes to meal staying power. Food volume, protein, fiber, and useful calories help; high density and drinks pull it down.'}
      </p>
      {power.beverageWeightG > 0 && (
        <p className="popover__note">
          Drink volume is shown for context, but it does not count as food volume for staying power.
        </p>
      )}
      {power.unknownFoodCalories > 0 && (
        <p className="popover__note">
          {round(power.unknownFoodCalories)} kcal have no logged food weight, so volume may be understated.
        </p>
      )}
    </div>
  )
}
