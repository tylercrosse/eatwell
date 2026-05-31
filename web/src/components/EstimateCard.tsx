import { MacroInput } from './MacroInput'
import { round } from '../lib/totals'

export interface Draft {
  food_name: string
  // Macros below are the baseline for ONE serving; the visible/saved values are
  // these scaled by `servings`. Editing a macro field adjusts this baseline.
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: string // free-text label describing a single serving
  servings: number // quantity multiplier applied to the baseline macros
}

const SERVINGS_STEP = 0.5
const SERVINGS_MIN = 0.25

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

  // Always positive (min-clamped below), so safe to divide by when editing macros.
  const f = draft.servings

  function setServings(next: number) {
    const clamped = Math.max(SERVINGS_MIN, Number.isFinite(next) ? next : SERVINGS_MIN)
    onChange({ servings: Math.round(clamped * 100) / 100 })
  }

  return (
    <div className="card estimate">
      {previewUrl && <img className="estimate__photo" src={previewUrl} alt="Food" />}

      {conf && <span className={`conf ${conf.cls}`}>{conf.text}</span>}

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

      <div className="field">
        <span className="field__label">Servings</span>
        <div className="servings">
          <button
            type="button"
            className="btn btn--icon servings__btn"
            onClick={() => setServings(draft.servings - SERVINGS_STEP)}
            disabled={draft.servings <= SERVINGS_MIN}
            aria-label="Decrease servings"
          >
            −
          </button>
          <input
            className="servings__value"
            type="number"
            inputMode="decimal"
            min={SERVINGS_MIN}
            step={SERVINGS_STEP}
            value={draft.servings}
            onChange={(e) => setServings(e.target.value === '' ? SERVINGS_MIN : Number(e.target.value))}
          />
          <button
            type="button"
            className="btn btn--icon servings__btn"
            onClick={() => setServings(draft.servings + SERVINGS_STEP)}
            aria-label="Increase servings"
          >
            +
          </button>
        </div>
      </div>

      <div className="macros">
        <MacroInput label="Calories" unit="kcal" value={draft.calories * f} onChange={(v) => onChange({ calories: v / f })} />
        <MacroInput label="Protein" unit="g" value={draft.protein_g * f} onChange={(v) => onChange({ protein_g: v / f })} />
        <MacroInput label="Carbs" unit="g" value={draft.carbs_g * f} onChange={(v) => onChange({ carbs_g: v / f })} />
        <MacroInput label="Fat" unit="g" value={draft.fat_g * f} onChange={(v) => onChange({ fat_g: v / f })} />
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
