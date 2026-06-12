import { useNumericDraft } from '../lib/useNumericDraft'

interface Props {
  label: string
  value: number
  unit?: string
  /** Show ± buttons that nudge the value by `step` (works on mobile, where native spinners don't). */
  stepper?: boolean
  /** Increment for the ± buttons. */
  step?: number
  onChange: (value: number) => void
}

/** A small labeled numeric field used for editing calories/macros. Clearing the field is
 *  allowed while editing — it stays empty so you can retype — and reverts to the current
 *  value on blur if left blank (an explicit "0" still commits). */
export function MacroInput({ label, value, unit, stepper, step = 1, onChange }: Props) {
  const num = useNumericDraft(value, (n) => (Number.isFinite(n) ? String(Math.round(n)) : ''), onChange)
  const nudge = (delta: number) => {
    num.reset() // a ± click overrides any in-progress typing
    onChange(Math.max(0, Math.round(value) + delta))
  }
  return (
    <label className={`macro-input${stepper ? ' macro-input--stepper' : ''}`}>
      <span className="macro-input__label">{label}</span>
      <span className="macro-input__field">
        {stepper && (
          <button
            type="button"
            className="btn btn--icon"
            onClick={() => nudge(-step)}
            disabled={value <= 0}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
        )}
        <span className="macro-input__control">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={num.text}
            onChange={(e) => num.onInput(e.target.value)}
            onBlur={num.onBlur}
          />
          {unit && <span className="macro-input__unit">{unit}</span>}
        </span>
        {stepper && (
          <button type="button" className="btn btn--icon" onClick={() => nudge(step)} aria-label={`Increase ${label}`}>
            +
          </button>
        )}
      </span>
    </label>
  )
}
