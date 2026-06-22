import type { EntryCreate, Meal } from '../types'
import type { MealGroup } from '../lib/meals'
import { MEAL_LABELS } from '../lib/meals'
import { round, formatFoodWeight, formatDrinkVolume } from '../lib/totals'
import { mealStayingPower } from '../lib/stayingPower'
import { EntryRow } from './EntryRow'
import { MacroBar } from './MacroBar'
import { MealIcon } from './MealIcon'
import { NutritionLegend } from './NutritionLegend'
import { StayingPowerBadge } from './StayingPowerBadge'

interface Props {
  group: MealGroup
  savingId: number | null // id of the entry currently being saved, if any
  showMacros: boolean // false hides macro legend/bars (Simple view)
  onSave: (id: number, patch: Partial<EntryCreate>) => void
  onDelete: (id: number) => void
  onAdd: (meal: Meal) => void // open the capture flow pre-scoped to this meal
}

/** One meal's section: a header with subtotals, its entry rows, and an "Add to …" button.
 *  Always rendered (even when empty) so logging can start from the meal you want. */
export function MealSection({ group, savingId, showMacros, onSave, onDelete, onAdd }: Props) {
  const { totals } = group
  const empty = group.entries.length === 0
  const stayingPower = mealStayingPower(group.entries)
  const volume = [
    stayingPower && stayingPower.foodWeightG > 0 ? formatFoodWeight(stayingPower.foodWeightG) : null,
    stayingPower && stayingPower.beverageWeightG > 0 ? formatDrinkVolume(stayingPower.beverageWeightG) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className={`meal-section${empty ? ' meal-section--empty' : ''}`}>
      <header className="meal-section__header">
        <div className="meal-section__title-row">
          <MealIcon meal={group.meal} size={22} />
          <span className="meal-section__title">{MEAL_LABELS[group.meal]}</span>
          {stayingPower && <StayingPowerBadge power={stayingPower} variant="compact" explain />}
          {volume && (
            <span className="meal-section__volume" title="Solid-food weight · drink volume">
              {volume}
            </span>
          )}
        </div>
        <span className="meal-section__totals">{empty ? '—' : `${round(totals.calories)} kcal`}</span>
        {showMacros && !empty && (
          <>
            <NutritionLegend food={totals} className="meal-section__nutrition" />
            <MacroBar protein_g={totals.protein_g} carbs_g={totals.carbs_g} fat_g={totals.fat_g} />
          </>
        )}
      </header>

      {!empty && (
        <ul className="entry-list entry-list--grouped">
          {group.entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              saving={savingId === e.id}
              showMacros={showMacros}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      <button type="button" className="meal-section__add" onClick={() => onAdd(group.meal)}>
        + Add to {MEAL_LABELS[group.meal].toLowerCase()}
      </button>
    </section>
  )
}
