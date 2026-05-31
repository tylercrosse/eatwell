import type { EntryCreate } from '../types'
import type { MealGroup } from '../lib/meals'
import { MEAL_LABELS } from '../lib/meals'
import { round } from '../lib/totals'
import { EntryRow } from './EntryRow'

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
  return (
    <section className="meal-section">
      <header className="meal-section__header">
        <span className="meal-section__title">{MEAL_LABELS[group.meal]}</span>
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
