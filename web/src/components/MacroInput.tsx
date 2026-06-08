import { useNumericDraft } from '../lib/useNumericDraft'

interface Props {
  label: string
  value: number
  unit?: string
  onChange: (value: number) => void
}

/** A small labeled numeric field used for editing calories/macros. Clearing the field is
 *  allowed while editing — it stays empty so you can retype — and reverts to the current
 *  value on blur if left blank (an explicit "0" still commits). */
export function MacroInput({ label, value, unit, onChange }: Props) {
  const num = useNumericDraft(value, (n) => (Number.isFinite(n) ? String(Math.round(n)) : ''), onChange)
  return (
    <label className="macro-input">
      <span className="macro-input__label">{label}</span>
      <span className="macro-input__field">
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
    </label>
  )
}
