import { MacroInput } from './MacroInput'

export interface Draft {
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: string
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

      <div className="macros">
        <MacroInput label="Calories" unit="kcal" value={draft.calories} onChange={(v) => onChange({ calories: v })} />
        <MacroInput label="Protein" unit="g" value={draft.protein_g} onChange={(v) => onChange({ protein_g: v })} />
        <MacroInput label="Carbs" unit="g" value={draft.carbs_g} onChange={(v) => onChange({ carbs_g: v })} />
        <MacroInput label="Fat" unit="g" value={draft.fat_g} onChange={(v) => onChange({ fat_g: v })} />
      </div>

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
