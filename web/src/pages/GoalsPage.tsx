import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MacroInput } from '../components/MacroInput'
import { getTargets, putTargets } from '../api/targets'
import { DEFAULT_TARGETS, macroGramTargets } from '../lib/targets'
import { round } from '../lib/totals'
import type { Targets } from '../types'

export function GoalsPage() {
  const queryClient = useQueryClient()
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })

  const [form, setForm] = useState<Targets>(DEFAULT_TARGETS)

  // Seed the form once the saved targets load.
  useEffect(() => {
    if (targetsQuery.data) setForm(targetsQuery.data)
  }, [targetsQuery.data])

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

  if (targetsQuery.isLoading) return <p className="muted">Loading…</p>

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

        {save.isError && <p className="error-text">Couldn't save targets. Try again.</p>}

        <button
          className="btn btn--primary"
          disabled={!pctOk || save.isPending}
          onClick={() => save.mutate(form)}
        >
          {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved ✓' : 'Save targets'}
        </button>
      </div>
    </div>
  )
}
