import { SERVINGS_MIN, SERVINGS_STEP, clampServings } from '../lib/serving'

interface Props {
  value: number
  onChange: (value: number) => void
}

/** ± stepper for the servings multiplier (shared by EstimateCard and EntryRow). Clamps
 *  to the minimum so the value is always safe to divide the per-serving baseline by. */
export function ServingsStepper({ value, onChange }: Props) {
  const set = (next: number) => onChange(clampServings(next))
  return (
    <div className="field">
      <span className="field__label">Servings</span>
      <div className="servings">
        <button
          type="button"
          className="btn btn--icon servings__btn"
          onClick={() => set(value - SERVINGS_STEP)}
          disabled={value <= SERVINGS_MIN}
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
          value={value}
          onChange={(e) => set(e.target.value === '' ? SERVINGS_MIN : Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn--icon servings__btn"
          onClick={() => set(value + SERVINGS_STEP)}
          aria-label="Increase servings"
        >
          +
        </button>
      </div>
    </div>
  )
}
