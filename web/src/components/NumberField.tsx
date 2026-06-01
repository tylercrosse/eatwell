interface Props {
  label: string
  value: number | null
  unit?: string
  min?: number
  step?: number | 'any'
  placeholder?: string
  onChange: (value: number | null) => void
}

/** Labeled numeric field that keeps decimals and allows empty (null) — unlike MacroInput,
 *  which rounds to integers. Used for weight, body-fat %, and goals. */
export function NumberField({ label, value, unit, min, step = 'any', placeholder, onChange }: Props) {
  return (
    <label className="macro-input">
      <span className="macro-input__label">{label}</span>
      <span className="macro-input__field">
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
    </label>
  )
}
