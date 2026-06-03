import type { EntryCreate } from '../types'
import type { MealGroup } from '../lib/meals'
import { MEAL_LABELS } from '../lib/meals'
import { round, formatFoodWeight, formatDrinkVolume } from '../lib/totals'
import { fullnessBreakdown } from '../lib/fullness'
import { EntryRow } from './EntryRow'
import { FullnessPill } from './FullnessBadge'

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
  // Calorie-weighted fullness + food weight / drink volume across the meal's items.
  const { avgScore: avgFullness, foodWeightG, beverageWeightG } = fullnessBreakdown(group.entries)
  const volume = [
    foodWeightG > 0 ? formatFoodWeight(foodWeightG) : null,
    beverageWeightG > 0 ? formatDrinkVolume(beverageWeightG) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="meal-section">
      <header className="meal-section__header">
        <div className="meal-section__title-row">
          <span className="meal-section__title">{MEAL_LABELS[group.meal]}</span>
          {avgFullness != null && (
            <FullnessPill score={avgFullness} variant="compact" title={`Meal average ${avgFullness.toFixed(1)} / 5`} />
          )}
          {volume && (
            <span className="meal-section__volume" title="Solid-food weight · drink volume">
              {volume}
            </span>
          )}
        </div>
        <span className="meal-section__totals">
          {round(totals.calories)} kcal · P {round(totals.protein_g)} · C {round(totals.carbs_g)} · F{' '}
          {round(totals.fat_g)}
        </span>
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
