import type { MacroTotals } from '../lib/totals'
import { round } from '../lib/totals'

/** Running calorie + macro totals for the selected day. */
export function DailyTotals({ totals }: { totals: MacroTotals }) {
  return (
    <div className="card totals">
      <div className="totals__calories">
        <span className="totals__cal-value">{round(totals.calories)}</span>
        <span className="totals__cal-unit">kcal</span>
      </div>
      <div className="totals__macros">
        <Macro label="Protein" value={totals.protein_g} />
        <Macro label="Carbs" value={totals.carbs_g} />
        <Macro label="Fat" value={totals.fat_g} />
      </div>
    </div>
  )
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="totals__macro">
      <span className="totals__macro-value">{round(value)}g</span>
      <span className="totals__macro-label">{label}</span>
    </div>
  )
}
