interface Props {
  label: string
  value: number
  unit?: string
  onChange: (value: number) => void
}

/** A small labeled numeric field used for editing calories/macros. */
export function MacroInput({ label, value, unit, onChange }: Props) {
  return (
    <label className="macro-input">
      <span className="macro-input__label">{label}</span>
      <span className="macro-input__field">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={Number.isFinite(value) ? Math.round(value) : 0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {unit && <span className="macro-input__unit">{unit}</span>}
      </span>
    </label>
  )
}
