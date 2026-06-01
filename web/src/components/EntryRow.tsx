import { useState } from 'react'
import type { Entry, EntryCreate, Meal } from '../types'
import { MEAL_LABELS, MEAL_ORDER, bucketOf } from '../lib/meals'
import { dayKeyOf, formatTime, localDayKey, withDayKey } from '../lib/date'
import { composeServingSize, parseServingSize } from '../lib/serving'
import { round } from '../lib/totals'
import { MacroInput } from './MacroInput'
import { DensityBadge } from './DensityBadge'
import { ServingsStepper } from './ServingsStepper'

/** "Fiber 5g · Sugar 12g · Sodium 400mg" for whichever detail fields are present. */
function extrasText(e: Entry): string {
  const parts: string[] = []
  if (e.fiber_g != null) parts.push(`Fiber ${round(e.fiber_g)}g`)
  if (e.sugar_g != null) parts.push(`Sugar ${round(e.sugar_g)}g`)
  if (e.sodium_mg != null) parts.push(`Sodium ${round(e.sodium_mg)}mg`)
  return parts.join(' · ')
}

interface Props {
  entry: Entry
  saving: boolean
  onSave: (id: number, patch: Partial<EntryCreate>) => void
  onDelete: (id: number) => void
}

interface EditForm {
  food_name: string
  serving_base: string // label for ONE serving (multiplier lives in `servings`)
  servings: number // quantity multiplier applied to the baseline macros
  meal: Meal
  logged_at: string // local datetime; the date is editable (to fix/backfill a day)
  // Macros below are the baseline for ONE serving; saved values are these scaled
  // by `servings`. Editing a macro field adjusts this baseline.
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g: number // 0 = unknown (a null entry value)
  fiber_g: number
  sugar_g: number
  sodium_mg: number
}

/** Split a stored entry back into the per-serving baseline the editor works on. */
function formFromEntry(e: Entry): EditForm {
  const { base, servings } = parseServingSize(e.serving_size)
  const f = servings || 1 // guard a parsed 0; always safe to divide by
  return {
    food_name: e.food_name,
    serving_base: base,
    servings: f,
    meal: bucketOf(e.meal),
    logged_at: e.logged_at,
    calories: e.calories / f,
    protein_g: e.protein_g / f,
    carbs_g: e.carbs_g / f,
    fat_g: e.fat_g / f,
    weight_g: (e.weight_g ?? 0) / f,
    fiber_g: (e.fiber_g ?? 0) / f,
    sugar_g: (e.sugar_g ?? 0) / f,
    sodium_mg: (e.sodium_mg ?? 0) / f,
  }
}

/** One logged entry: a compact display row that expands into an edit form. */
export function EntryRow({ entry, saving, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>(() => formFromEntry(entry))

  function startEdit() {
    setForm(formFromEntry(entry)) // re-seed in case the entry changed since last open
    setEditing(true)
  }

  function save() {
    const f = form.servings // baseline macros scaled by the chosen quantity
    const name = form.food_name.trim()
    const scaledOrNull = (v: number) => (v > 0 ? v * f : null) // keep unset detail fields null
    onSave(entry.id, {
      food_name: name || entry.food_name, // never blank out the name
      serving_size: composeServingSize(form.serving_base, form.servings) || null,
      meal: form.meal,
      logged_at: form.logged_at,
      calories: form.calories * f,
      protein_g: form.protein_g * f,
      carbs_g: form.carbs_g * f,
      fat_g: form.fat_g * f,
      weight_g: scaledOrNull(form.weight_g),
      fiber_g: scaledOrNull(form.fiber_g),
      sugar_g: scaledOrNull(form.sugar_g),
      sodium_mg: scaledOrNull(form.sodium_mg),
    })
    setEditing(false)
  }

  if (editing) {
    const f = form.servings // always >= SERVINGS_MIN, so safe to divide by
    return (
      <li className="card entry entry--editing">
        <div className="entry-edit">
          <label className="field">
            <span className="field__label">Food</span>
            <input
              type="text"
              value={form.food_name}
              onChange={(e) => setForm({ ...form, food_name: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field__label">Serving</span>
            <input
              type="text"
              value={form.serving_base}
              placeholder="e.g. 1 bowl (~300g)"
              onChange={(e) => setForm({ ...form, serving_base: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field__label">Meal</span>
            <select value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value as Meal })}>
              {MEAL_ORDER.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABELS[m]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Date</span>
            <input
              type="date"
              max={localDayKey()}
              value={dayKeyOf(form.logged_at)}
              onChange={(e) =>
                setForm({ ...form, logged_at: withDayKey(form.logged_at, e.target.value || localDayKey()) })
              }
            />
          </label>

          <ServingsStepper value={form.servings} onChange={(v) => setForm({ ...form, servings: v })} />

          <div className="macros">
            <MacroInput label="Calories" unit="kcal" value={form.calories * f} onChange={(v) => setForm({ ...form, calories: v / f })} />
            <MacroInput label="Protein" unit="g" value={form.protein_g * f} onChange={(v) => setForm({ ...form, protein_g: v / f })} />
            <MacroInput label="Carbs" unit="g" value={form.carbs_g * f} onChange={(v) => setForm({ ...form, carbs_g: v / f })} />
            <MacroInput label="Fat" unit="g" value={form.fat_g * f} onChange={(v) => setForm({ ...form, fat_g: v / f })} />
          </div>

          <div className="macros">
            <MacroInput label="Weight" unit="g" value={form.weight_g * f} onChange={(v) => setForm({ ...form, weight_g: v / f })} />
            <MacroInput label="Fiber" unit="g" value={form.fiber_g * f} onChange={(v) => setForm({ ...form, fiber_g: v / f })} />
            <MacroInput label="Sugar" unit="g" value={form.sugar_g * f} onChange={(v) => setForm({ ...form, sugar_g: v / f })} />
            <MacroInput label="Sodium" unit="mg" value={form.sodium_mg * f} onChange={(v) => setForm({ ...form, sodium_mg: v / f })} />
          </div>

          {form.servings !== 1 && (
            <p className="per-serving-hint">
              Per serving: {round(form.calories)} kcal · P {round(form.protein_g)} · C{' '}
              {round(form.carbs_g)} · F {round(form.fat_g)}
            </p>
          )}

          <div className="estimate__actions">
            <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  const extras = extrasText(entry)
  const hasDensity = entry.weight_g != null && entry.weight_g > 0
  return (
    <li className="card entry">
      <div className="entry__main">
        <span className="entry__name">{entry.food_name}</span>
        <span className="entry__meta">
          {formatTime(entry.logged_at)}
          {entry.serving_size ? ` · ${entry.serving_size}` : ''}
        </span>
        <span className="entry__macros">
          P {round(entry.protein_g)} · C {round(entry.carbs_g)} · F {round(entry.fat_g)}
        </span>
        {(hasDensity || extras) && (
          <span className="entry__extras">
            <DensityBadge calories={entry.calories} weightG={entry.weight_g} variant="compact" />
            {extras && <span>{extras}</span>}
          </span>
        )}
      </div>
      <div className="entry__right">
        <span className="entry__cal">{round(entry.calories)}</span>
        <span className="entry__cal-unit">kcal</span>
      </div>
      <button className="entry__action" aria-label="Edit entry" onClick={startEdit}>
        ✎
      </button>
      <button className="entry__delete" aria-label="Delete entry" onClick={() => onDelete(entry.id)}>
        ✕
      </button>
    </li>
  )
}
