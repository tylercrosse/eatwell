import { SERVINGS_MIN, SERVINGS_STEP, clampServings, formatServings } from '../lib/serving'
import { useNumericDraft } from '../lib/useNumericDraft'

interface Props {
  value: number
  onChange: (value: number) => void
}

/** ± stepper for the servings multiplier (shared by EstimateCard and EntryRow). Clamps
 *  to the minimum so the value is always safe to divide the per-serving baseline by. The
 *  text field can be cleared while editing and reverts to the current value on blur. */
export function ServingsStepper({ value, onChange }: Props) {
  const set = (next: number) => onChange(clampServings(next))
  const num = useNumericDraft(value, formatServings, set)
  const step = (next: number) => {
    num.reset() // a ± click overrides any in-progress typing
    set(next)
  }
  return (
    <div className="field">
      <span className="field__label">Servings</span>
      <div className="servings">
        <button
          type="button"
          className="btn btn--icon servings__btn"
          onClick={() => step(value - SERVINGS_STEP)}
          disabled={value <= SERVINGS_MIN}
          aria-label="Decrease servings"
        >
          −
        </button>
        <input
          className="servings__value"
          type="text"
          inputMode="decimal"
          value={num.text}
          onChange={(e) => num.onInput(e.target.value)}
          onBlur={num.onBlur}
        />
        <button
          type="button"
          className="btn btn--icon servings__btn"
          onClick={() => step(value + SERVINGS_STEP)}
          aria-label="Increase servings"
        >
          +
        </button>
      </div>
    </div>
  )
}
