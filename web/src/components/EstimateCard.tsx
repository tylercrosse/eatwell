import { MacroInput } from './MacroInput'
import { DensityBadge } from './DensityBadge'
import { ServingsStepper } from './ServingsStepper'
import { round } from '../lib/totals'
import { MEAL_LABELS, MEAL_ORDER } from '../lib/meals'
import { dayKeyOf, localDayKey, withDayKey } from '../lib/date'
import type { Meal } from '../types'

export interface Draft {
  food_name: string
  // Macros below are the baseline for ONE serving; the visible/saved values are
  // these scaled by `servings`. Editing a macro field adjusts this baseline.
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g: number // total edible weight (powers the density badge); 0 = unknown
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  serving_size: string // free-text label describing a single serving
  servings: number // quantity multiplier applied to the baseline macros
  meal: Meal // which meal this entry belongs to
  logged_at: string // local datetime; the date is editable (to backfill a past day)
}

interface Props {
  draft: Draft
  confidence: number | null
  previewUrl: string | null
  saving: boolean
  onChange: (patch: Partial<Draft>) => void
  onConfirm: () => void
  onCancel: () => void
}

function confidenceLabel(c: number): { text: string; cls: string } {
  if (c >= 0.66) return { text: 'High confidence', cls: 'conf--high' }
  if (c >= 0.33) return { text: 'Medium confidence', cls: 'conf--med' }
  return { text: 'Low confidence — double-check', cls: 'conf--low' }
}

/** Review + edit the AI estimate before committing it to the log. */
export function EstimateCard({
  draft,
  confidence,
  previewUrl,
  saving,
  onChange,
  onConfirm,
  onCancel,
}: Props) {
  const conf = confidence != null ? confidenceLabel(confidence) : null

  // Always positive (ServingsStepper clamps to the minimum), so safe to divide by.
  const f = draft.servings

  return (
    <div className="card estimate">
      {previewUrl && <img className="estimate__photo" src={previewUrl} alt="Food" />}

      {conf && <span className={`conf ${conf.cls}`}>{conf.text}</span>}

      {/* Density is a ratio, so the per-serving baseline gives the same band as the total. */}
      <DensityBadge calories={draft.calories} weightG={draft.weight_g} />

      <label className="field">
        <span className="field__label">Food</span>
        <input
          type="text"
          value={draft.food_name}
          onChange={(e) => onChange({ food_name: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Serving</span>
        <input
          type="text"
          value={draft.serving_size}
          placeholder="e.g. 1 bowl (~300g)"
          onChange={(e) => onChange({ serving_size: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Meal</span>
        <select value={draft.meal} onChange={(e) => onChange({ meal: e.target.value as Meal })}>
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
          value={dayKeyOf(draft.logged_at)}
          onChange={(e) => onChange({ logged_at: withDayKey(draft.logged_at, e.target.value || localDayKey()) })}
        />
      </label>

      <ServingsStepper value={draft.servings} onChange={(v) => onChange({ servings: v })} />

      <div className="macros">
        <MacroInput label="Calories" unit="kcal" value={draft.calories * f} onChange={(v) => onChange({ calories: v / f })} />
        <MacroInput label="Protein" unit="g" value={draft.protein_g * f} onChange={(v) => onChange({ protein_g: v / f })} />
        <MacroInput label="Carbs" unit="g" value={draft.carbs_g * f} onChange={(v) => onChange({ carbs_g: v / f })} />
        <MacroInput label="Fat" unit="g" value={draft.fat_g * f} onChange={(v) => onChange({ fat_g: v / f })} />
      </div>

      <div className="macros">
        <MacroInput label="Weight" unit="g" value={draft.weight_g * f} onChange={(v) => onChange({ weight_g: v / f })} />
        <MacroInput label="Fiber" unit="g" value={draft.fiber_g * f} onChange={(v) => onChange({ fiber_g: v / f })} />
        <MacroInput label="Sugar" unit="g" value={draft.sugar_g * f} onChange={(v) => onChange({ sugar_g: v / f })} />
        <MacroInput label="Sodium" unit="mg" value={draft.sodium_mg * f} onChange={(v) => onChange({ sodium_mg: v / f })} />
      </div>

      {draft.servings !== 1 && (
        <p className="per-serving-hint">
          Per serving: {round(draft.calories)} kcal · P {round(draft.protein_g)} · C{' '}
          {round(draft.carbs_g)} · F {round(draft.fat_g)}
        </p>
      )}

      <div className="estimate__actions">
        <button className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Discard
        </button>
        <button className="btn btn--primary" onClick={onConfirm} disabled={saving}>
          {saving ? 'Saving…' : 'Add to log'}
        </button>
      </div>
    </div>
  )
}
