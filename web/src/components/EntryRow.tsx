import { useLayoutEffect, useRef, useState } from 'react'
import type { Entry, EntryCreate, Meal } from '../types'
import { MEAL_LABELS, MEAL_ORDER, bucketOf } from '../lib/meals'
import { dayKeyOf, formatTime, localDayKey, withDayKey } from '../lib/date'
import { composeServingSize, parseServingSize } from '../lib/serving'
import { round } from '../lib/totals'
import { isBeverageForFullness } from '../lib/fullness'
import {
  mealStayingPower,
  STAYING_POWER_LABELS,
  type StayingPowerTier,
} from '../lib/stayingPower'
import { MacroEditorFields } from './MacroEditorFields'
import { FoodIcon } from './FoodIcon'
import { CalorieValue } from './CalorieValue'
import { MacroBar } from './MacroBar'
import { NutritionLegend } from './NutritionLegend'
import { Popover } from './Popover'
import { ServingsStepper } from './ServingsStepper'
import { StayingPowerExplainer } from './StayingPowerExplainer'

/** Secondary nutrients that do not share the macro/fiber color language. */
function detailNutrients(e: Entry): string {
  const parts: string[] = []
  if (e.sugar_g != null) parts.push(`Sugar ${round(e.sugar_g)}g`)
  if (e.sodium_mg != null) parts.push(`Sodium ${round(e.sodium_mg)}mg`)
  return parts.join(' · ')
}

const SUPPORT_CLASS: Record<StayingPowerTier, string> = {
  strong: 'entry-support--strong',
  solid: 'entry-support--solid',
  moderate: 'entry-support--moderate',
  light: 'entry-support--light',
}

function EntrySupport({ entry }: { entry: Entry }) {
  const support = mealStayingPower([entry])
  if (!support) return null
  const label = STAYING_POWER_LABELS[support.tier]
  const pill = (
    <span
      className={`entry-support ${SUPPORT_CLASS[support.tier]}`}
      title="How much this logged portion supports meal staying power"
    >
      {label} support
    </span>
  )
  return (
    <Popover
      label="Why this item supports fullness"
      content={<StayingPowerExplainer power={support} title={`${label} support`} scope="item" />}
    >
      {pill}
    </Popover>
  )
}

interface Props {
  entry: Entry
  saving: boolean
  showMacros: boolean // false hides the macro/fiber + support adornment (Simple view)
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
  is_beverage: boolean
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
    is_beverage: isBeverageForFullness(e),
  }
}

/** One logged entry: a compact display row that expands into an edit form. */
export function EntryRow({ entry, saving, showMacros, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>(() => formFromEntry(entry))
  const foodRef = useRef<HTMLTextAreaElement>(null)

  // Grow the food name field to fit its content so long names wrap instead of
  // forcing an awkward in-input scroll. Runs on open and on every keystroke.
  useLayoutEffect(() => {
    const el = foodRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, form.food_name])

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
      is_beverage: form.is_beverage,
    })
    setEditing(false)
  }

  if (editing) {
    const f = form.servings // always >= SERVINGS_MIN, so safe to divide by
    const caloriesOk = form.calories * f > 0 // an entry with no calories isn't worth logging
    return (
      <li className="entry entry--editing">
        <div className="entry-edit">
          <label className="field">
            <span className="field__label">Food</span>
            <textarea
              ref={foodRef}
              className="field__grow"
              rows={1}
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

          <label className="estimate__beverage">
            <input
              type="checkbox"
              checked={form.is_beverage}
              onChange={(e) => setForm({ ...form, is_beverage: e.target.checked })}
            />
            Drink
          </label>

          <MacroEditorFields values={form} servings={f} onChange={(patch) => setForm({ ...form, ...patch })} />

          {form.servings !== 1 && (
            <p className="per-serving-hint">
              Per serving: {round(form.calories)} kcal · Protein {round(form.protein_g)}g · Fat {round(form.fat_g)}g ·
              Carbs {round(form.carbs_g)}g · Fiber {round(form.fiber_g)}g
            </p>
          )}

          {!caloriesOk && <p className="input-warn">Calories must be greater than 0.</p>}

          <div className="estimate__actions">
            <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save} disabled={saving || !caloriesOk}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  const details = detailNutrients(entry)
  return (
    <li className="entry">
      <FoodIcon entry={entry} />
      <div className="entry__main">
        <span className="entry__name">{entry.food_name}</span>
        <span className="entry__meta">
          {formatTime(entry.logged_at)}
          {entry.serving_size ? ` · ${entry.serving_size}` : ''}
        </span>
        {showMacros && (
          <>
            <MacroBar protein_g={entry.protein_g} carbs_g={entry.carbs_g} fat_g={entry.fat_g} />
            <NutritionLegend food={entry} />
            <span className="entry__signals">
              <EntrySupport entry={entry} />
              {details && <span className="entry__details">{details}</span>}
            </span>
          </>
        )}
      </div>
      <CalorieValue calories={entry.calories} />
      <button className="entry__action" aria-label="Edit entry" onClick={startEdit}>
        ✎
      </button>
      <button className="entry__delete" aria-label="Delete entry" onClick={() => onDelete(entry.id)}>
        ✕
      </button>
    </li>
  )
}
