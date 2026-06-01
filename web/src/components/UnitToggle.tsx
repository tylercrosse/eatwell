import type { WeightUnit } from '../lib/units'

const UNITS: WeightUnit[] = ['kg', 'lb']

/** Small kg/lb segmented toggle (reuses the .seg segmented-control styles). */
export function UnitToggle({ unit, onChange }: { unit: WeightUnit; onChange: (u: WeightUnit) => void }) {
  return (
    <div className="seg" role="group" aria-label="Weight unit">
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          className={`seg__btn ${unit === u ? 'is-active' : ''}`}
          onClick={() => onChange(u)}
        >
          {u}
        </button>
      ))}
    </div>
  )
}
