interface Props {
  label: string
  value: number | null
  unit?: string
  min?: number
  step?: number | 'any'
  /** Show ± buttons that nudge the value by `step` (works on mobile, where native spinners don't). */
  stepper?: boolean
  placeholder?: string
  onChange: (value: number | null) => void
}

/** Labeled numeric field that keeps decimals and allows empty (null) — unlike MacroInput,
 *  which rounds to integers. Used for weight, body-fat %, and goals. */
export function NumberField({ label, value, unit, min, step = 'any', stepper, placeholder, onChange }: Props) {
  const inc = typeof step === 'number' ? step : 1
  const decimals = (String(inc).split('.')[1] ?? '').length
  const nudge = (delta: number) => {
    let next = (value ?? min ?? 0) + delta
    if (decimals) next = Number(next.toFixed(decimals)) // avoid float noise from repeated 0.1 steps
    if (min != null) next = Math.max(min, next)
    onChange(next)
  }
  const atMin = value == null || (min != null && value <= min)
  return (
    <label className={`macro-input${stepper ? ' macro-input--stepper' : ''}`}>
      <span className="macro-input__label">{label}</span>
      <span className="macro-input__field">
        {stepper && (
          <button
            type="button"
            className="btn btn--icon"
            onClick={() => nudge(-inc)}
            disabled={atMin}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
        )}
        <span className="macro-input__control">
          <input
            type="number"
            inputMode="decimal"
            min={min}
            step={step}
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
          {unit && <span className="macro-input__unit">{unit}</span>}
        </span>
        {stepper && (
          <button type="button" className="btn btn--icon" onClick={() => nudge(inc)} aria-label={`Increase ${label}`}>
            +
          </button>
        )}
      </span>
    </label>
  )
}
