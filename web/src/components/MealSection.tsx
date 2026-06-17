import type { EntryCreate } from '../types'
import type { MealGroup } from '../lib/meals'
import { MEAL_LABELS } from '../lib/meals'
import { round, formatFoodWeight, formatDrinkVolume } from '../lib/totals'
import { mealStayingPower } from '../lib/stayingPower'
import { EntryRow } from './EntryRow'
import { MacroBar } from './MacroBar'
import { NutritionLegend } from './NutritionLegend'
import { StayingPowerBadge } from './StayingPowerBadge'

interface Props {
  group: MealGroup
  savingId: number | null // id of the entry currently being saved, if any
  onSave: (id: number, patch: Partial<EntryCreate>) => void
  onDelete: (id: number) => void
}

/** One meal's section: a header with subtotals + its entry rows. */
export function MealSection({ group, savingId, onSave, onDelete }: Props) {
  if (group.entries.length === 0) return null // empty meals are hidden
  const { totals } = group
  const stayingPower = mealStayingPower(group.entries)
  const volume = [
    stayingPower && stayingPower.foodWeightG > 0 ? formatFoodWeight(stayingPower.foodWeightG) : null,
    stayingPower && stayingPower.beverageWeightG > 0 ? formatDrinkVolume(stayingPower.beverageWeightG) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="meal-section">
      <header className="meal-section__header">
        <div className="meal-section__title-row">
          <span className="meal-section__title">{MEAL_LABELS[group.meal]}</span>
          {stayingPower && <StayingPowerBadge power={stayingPower} variant="compact" explain />}
          {volume && (
            <span className="meal-section__volume" title="Solid-food weight · drink volume">
              {volume}
            </span>
          )}
        </div>
        <span className="meal-section__totals">{round(totals.calories)} kcal</span>
        <NutritionLegend food={totals} className="meal-section__nutrition" />
        <MacroBar protein_g={totals.protein_g} carbs_g={totals.carbs_g} fat_g={totals.fat_g} />
      </header>

      <ul className="entry-list">
        {group.entries.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            saving={savingId === e.id}
            onSave={onSave}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  )
}
