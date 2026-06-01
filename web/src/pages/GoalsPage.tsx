import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MacroInput } from '../components/MacroInput'
import { NumberField } from '../components/NumberField'
import { UnitToggle } from '../components/UnitToggle'
import { getTargets, putTargets } from '../api/targets'
import { DEFAULT_TARGETS, macroGramTargets } from '../lib/targets'
import { round } from '../lib/totals'
import { displayToKg, kgToDisplay, useWeightUnit } from '../lib/units'
import type { Targets } from '../types'

export function GoalsPage() {
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })
  if (targetsQuery.isLoading) return <p className="muted">Loading…</p>
  // Key on the loaded data so the form initializes from it once, without a seeding effect.
  return <GoalsForm initial={targetsQuery.data ?? DEFAULT_TARGETS} />
}

/** Round a display-unit value to 1 decimal, or null. Keeps kg↔lb switches from showing noise. */
function show(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 10) / 10
}

function GoalsForm({ initial }: { initial: Targets }) {
  const queryClient = useQueryClient()
  const [unit, setUnit] = useWeightUnit()
  const [form, setForm] = useState<Targets>(initial)

  const save = useMutation({
    mutationFn: putTargets,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['targets'] }),
  })

  const pctTotal = form.protein_pct + form.carbs_pct + form.fat_pct
  const pctOk = Math.abs(pctTotal - 100) < 0.5
  const grams = macroGramTargets(form)

  function set(patch: Partial<Targets>) {
    if (save.isSuccess) save.reset() // clear the "Saved ✓" state once the user edits again
    setForm((f) => ({ ...f, ...patch }))
  }

  // Goal weight + weekly rate are stored in kg; edit in the chosen display unit.
  const setGoalWeight = (v: number | null) =>
    set({ goal_weight_kg: v == null ? null : displayToKg(v, unit) })
  const setWeeklyRate = (v: number | null) =>
    set({ weekly_rate_kg: v == null ? null : displayToKg(v, unit) })

  return (
    <div className="page">
      <div className="card goals">
        <h2 className="goals__heading">Daily targets</h2>

        <MacroInput label="Calories" unit="kcal" value={form.calorie_target} onChange={(v) => set({ calorie_target: v })} />

        <div className="goals__split">
          <span className="field__label">Macro split (% of calories)</span>
          <div className="macros">
            <MacroInput label="Protein" unit="%" value={form.protein_pct} onChange={(v) => set({ protein_pct: v })} />
            <MacroInput label="Carbs" unit="%" value={form.carbs_pct} onChange={(v) => set({ carbs_pct: v })} />
            <MacroInput label="Fat" unit="%" value={form.fat_pct} onChange={(v) => set({ fat_pct: v })} />
          </div>
          <p className={`goals__total ${pctOk ? '' : 'goals__total--bad'}`}>
            Total: {round(pctTotal)}%{pctOk ? '' : ' — must add up to 100%'}
          </p>
        </div>

        <p className="goals__grams muted">
          ≈ {round(grams.protein_g)} g protein · {round(grams.carbs_g)} g carbs · {round(grams.fat_g)} g fat
        </p>
      </div>

      <div className="card goals">
        <div className="goals__heading-row">
          <h2 className="goals__heading">Body goals</h2>
          <UnitToggle unit={unit} onChange={setUnit} />
        </div>
        <div className="macros">
          <NumberField
            label="Goal weight"
            unit={unit}
            min={0}
            value={show(form.goal_weight_kg == null ? null : kgToDisplay(form.goal_weight_kg, unit))}
            onChange={setGoalWeight}
          />
          <NumberField
            label="Goal body fat"
            unit="%"
            min={0}
            value={show(form.goal_body_fat_pct ?? null)}
            onChange={(v) => set({ goal_body_fat_pct: v })}
          />
          <NumberField
            label="Weekly change"
            unit={`${unit}/wk`}
            value={show(form.weekly_rate_kg == null ? null : kgToDisplay(form.weekly_rate_kg, unit))}
            onChange={setWeeklyRate}
          />
        </div>
        <p className="goals__grams muted">Negative weekly change = losing; positive = gaining.</p>
      </div>

      {save.isError && <p className="error-text">Couldn't save targets. Try again.</p>}

      <button
        className="btn btn--primary"
        disabled={!pctOk || save.isPending}
        onClick={() => save.mutate(form)}
      >
        {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved ✓' : 'Save goals'}
      </button>
    </div>
  )
}
