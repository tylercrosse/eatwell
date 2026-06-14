import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MacroInput } from '../components/MacroInput'
import { NumberField } from '../components/NumberField'
import { UnitToggle } from '../components/UnitToggle'
import { getTargets, putTargets } from '../api/targets'
import { getLatestMetric, getMetrics } from '../api/metrics'
import { getEntriesRange } from '../api/entries'
import { DEFAULT_TARGETS, fiberGramTarget, macroGramTargets, goalDirection } from '../lib/targets'
import { MACRO_ORDER, NUTRITION_DISPLAY, type MacroKey } from '../lib/nutritionDisplay'
import { round, round1 } from '../lib/totals'
import { cmToFtIn, displayToKg, ftInToCm, kgToDisplay, useWeightUnit } from '../lib/units'
import { formatFullDay, lastNDays, localDayKey, shiftDay } from '../lib/date'
import { adaptiveTdee, staticTdee, targetForRate } from '../lib/tdee'
import type { Targets } from '../types'

const ACTIVITY_OPTIONS = [
  { value: 1.2, label: 'Sedentary (little exercise)' },
  { value: 1.375, label: 'Light (1–3 days/wk)' },
  { value: 1.55, label: 'Moderate (3–5 days/wk)' },
  { value: 1.725, label: 'Very active (6–7 days/wk)' },
  { value: 1.9, label: 'Athlete (2×/day)' },
]

const TARGET_PCT_FIELD: Record<MacroKey, 'fat_pct' | 'protein_pct' | 'carbs_pct'> = {
  fat: 'fat_pct',
  protein: 'protein_pct',
  carbs: 'carbs_pct',
}

const TARGET_GRAM_FIELD: Record<MacroKey, 'fat_g' | 'protein_g' | 'carbs_g'> = {
  fat: 'fat_g',
  protein: 'protein_g',
  carbs: 'carbs_g',
}

export function GoalsPage() {
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })
  if (targetsQuery.isLoading) return <p className="muted">Loading…</p>
  return <GoalsForm initial={targetsQuery.data ?? DEFAULT_TARGETS} />
}

/** Round a display-unit value to 1 decimal, or null. Keeps kg↔lb switches from showing noise. */
function show(value: number | null | undefined): number | null {
  return value == null ? null : round1(value)
}

function GoalsForm({ initial }: { initial: Targets }) {
  const queryClient = useQueryClient()
  const [unit, setUnit] = useWeightUnit()
  const [form, setForm] = useState<Targets>(initial)

  const axis = lastNDays(28)
  const from = axis[0]
  const to = axis[axis.length - 1]
  const metricsQuery = useQuery({ queryKey: ['metrics', from, to], queryFn: () => getMetrics(from, to) })
  const latestWeightQuery = useQuery({ queryKey: ['metrics', 'latest'], queryFn: getLatestMetric })
  const rangeQuery = useQuery({ queryKey: ['entries-range', from, to], queryFn: () => getEntriesRange(from, to) })

  const save = useMutation({
    mutationFn: putTargets,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['targets'] }),
  })

  const pctTotal = form.protein_pct + form.carbs_pct + form.fat_pct
  const pctOk = Math.abs(pctTotal - 100) < 0.5
  const calorieOk = form.calorie_target > 0
  const grams = macroGramTargets(form)
  const fiberTarget = fiberGramTarget(form)

  function set(patch: Partial<Targets>) {
    if (save.isSuccess) save.reset()
    setForm((f) => ({ ...f, ...patch }))
  }

  const setGoalWeight = (v: number | null) => set({ goal_weight_kg: v == null ? null : displayToKg(v, unit) })

  // Weekly rate is stored as a positive magnitude; direction comes from goal vs current weight.
  const magnitudeKg = Math.abs(form.weekly_rate_kg ?? 0)
  const rateMagDisplay = form.weekly_rate_kg ? show(kgToDisplay(magnitudeKg, unit)) : null
  const onRate = (v: number | null) => set({ weekly_rate_kg: v == null ? null : displayToKg(v, unit) })

  // Height: stored in cm; edited as cm (metric) or ft+in (imperial).
  const hf = form.height_cm != null ? cmToFtIn(form.height_cm) : { ft: null as number | null, inch: null as number | null }
  const setHeightFt = (ft: number | null) => set({ height_cm: ftInToCm(ft ?? 0, hf.inch ?? 0) })
  const setHeightIn = (inch: number | null) => set({ height_cm: ftInToCm(hf.ft ?? 0, inch ?? 0) })

  // --- Current weight, goal direction + projection ---
  const metrics = metricsQuery.data ?? [] // 28-day series, for the adaptive TDEE trend
  const latestMetric = latestWeightQuery.data ?? null // most recent weight, any date
  const currentKg = latestMetric?.weight_kg ?? null
  const goalKg = form.goal_weight_kg ?? null
  const diffKg = goalKg != null && currentKg != null ? goalKg - currentKg : null
  const direction = goalDirection(goalKg, currentKg)
  const weeks = direction && direction !== 'maintain' && magnitudeKg > 0 ? Math.abs(diffKg ?? 0) / magnitudeKg : null
  const toGoDisplay = diffKg != null ? show(Math.abs(kgToDisplay(diffKg, unit))) : null

  let planLine: string | null = null
  if (direction === 'maintain') {
    planLine = 'At your goal weight 🎉'
  } else if (direction) {
    const base = `${toGoDisplay} ${unit} to ${direction}`
    planLine =
      weeks != null
        ? `${base} · ~${Math.round(weeks)} wks · est. ${formatFullDay(shiftDay(localDayKey(), Math.round(weeks * 7)))}`
        : `${base} · set a weekly rate`
  }

  // --- TDEE recommendation (rate signed by the derived direction) ---
  const profileTdee = staticTdee({
    weightKg: currentKg,
    heightCm: form.height_cm,
    birthYear: form.birth_year,
    sex: form.sex,
    activityFactor: form.activity_factor,
    currentYear: new Date().getFullYear(),
  })
  const adaptive = adaptiveTdee(rangeQuery.data ?? [], metrics)
  const baseTdee = adaptive?.tdee ?? profileTdee
  const effectiveRateKg = direction === 'lose' ? -magnitudeKg : direction === 'gain' ? magnitudeKg : 0
  const recommended = baseTdee == null ? null : targetForRate(baseTdee, effectiveRateKg)
  const delta = recommended != null && baseTdee != null ? recommended - baseTdee : 0

  return (
    <div className="page">
      <div className="card goals">
        <h2 className="goals__heading">Daily targets</h2>
        <MacroInput label="Calories" unit="kcal" stepper step={10} value={form.calorie_target} onChange={(v) => set({ calorie_target: v })} />
        {!calorieOk && <p className="input-warn">Calorie target must be greater than 0.</p>}
        <div className="goals__split">
          <span className="field__label">Macro split (% of calories)</span>
          <div className="macros">
            {MACRO_ORDER.map((key) => {
              const display = NUTRITION_DISPLAY[key]
              const field = TARGET_PCT_FIELD[key]
              return (
                <MacroInput
                  key={key}
                  label={display.label}
                  unit="%"
                  colorVar={display.colorVar}
                  stepper
                  value={form[field]}
                  onChange={(v) => set({ [field]: v })}
                />
              )
            })}
          </div>
          <p className={`goals__total ${pctOk ? '' : 'goals__total--bad'}`}>
            Total: {round(pctTotal)}%{pctOk ? '' : ' — must add up to 100%'}
          </p>
        </div>
        <p className="goals__grams muted">
          ≈{' '}
          {MACRO_ORDER.map((key) => `${round(grams[TARGET_GRAM_FIELD[key]])} g ${NUTRITION_DISPLAY[key].label.toLowerCase()}`).join(' · ')}{' '}
          · {round(fiberTarget)} g fiber
        </p>
      </div>

      <div className="card goals">
        <div className="goals__heading-row">
          <h2 className="goals__heading">Body goals</h2>
          <UnitToggle unit={unit} onChange={setUnit} />
        </div>
        <p className="goals__grams muted">
          {currentKg != null
            ? `Current: ${show(kgToDisplay(currentKg, unit))} ${unit}${latestMetric ? ` · logged ${formatFullDay(latestMetric.date)}` : ''}`
            : 'No weight logged yet — add one from the Log tab.'}
        </p>
        <div className="macros">
          <NumberField
            label="Goal weight"
            unit={unit}
            min={0}
            stepper
            value={show(form.goal_weight_kg == null ? null : kgToDisplay(form.goal_weight_kg, unit))}
            onChange={setGoalWeight}
          />
          <NumberField label="Goal body fat" unit="%" min={0} stepper value={show(form.goal_body_fat_pct ?? null)} onChange={(v) => set({ goal_body_fat_pct: v })} />
          <NumberField label="Rate" unit={`${unit}/wk`} min={0} step={0.1} stepper value={rateMagDisplay} onChange={onRate} />
        </div>
        {planLine && <p className="goals__plan">{planLine}</p>}
      </div>

      <div className="card goals">
        <h2 className="goals__heading">Profile (for the calorie estimate)</h2>
        <div className="macros">
          {unit === 'kg' ? (
            <NumberField label="Height" unit="cm" min={0} value={show(form.height_cm ?? null)} onChange={(v) => set({ height_cm: v })} />
          ) : (
            <>
              <NumberField label="Height" unit="ft" min={0} step={1} value={hf.ft} onChange={setHeightFt} />
              <NumberField label="Inches" unit="in" min={0} step={1} value={hf.inch} onChange={setHeightIn} />
            </>
          )}
          <NumberField label="Birth year" min={1900} step={1} value={form.birth_year ?? null} onChange={(v) => set({ birth_year: v })} />
          <label className="macro-input">
            <span className="macro-input__label">Sex</span>
            <span className="macro-input__field">
              <select value={form.sex ?? ''} onChange={(e) => set({ sex: (e.target.value || null) as Targets['sex'] })}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </span>
          </label>
          <label className="macro-input">
            <span className="macro-input__label">Activity</span>
            <span className="macro-input__field">
              <select
                value={form.activity_factor ?? ''}
                onChange={(e) => set({ activity_factor: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {ACTIVITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      </div>

      <div className="card goals">
        <h2 className="goals__heading">Recommended calories</h2>
        {profileTdee == null && adaptive == null ? (
          <p className="muted">Add your height, birth year, sex, and a recent weight to get an estimate.</p>
        ) : (
          <>
            {profileTdee != null && (
              <p className="goals__grams">
                Profile TDEE: <strong>{round(profileTdee)}</strong> kcal/day
              </p>
            )}
            {adaptive != null && (
              <p className="goals__grams">
                Adaptive TDEE (last {adaptive.days}d, {adaptive.loggedDays} logged):{' '}
                <strong>{round(adaptive.tdee)}</strong> kcal/day
              </p>
            )}
            {recommended != null && (
              <div className="goals__rec">
                <span>
                  Suggested daily target: <strong>{round(recommended)}</strong> kcal{' '}
                  {Math.round(delta) !== 0 && (
                    <span className="muted">
                      ({delta < 0 ? '−' : '+'}
                      {round(Math.abs(delta))}/day {delta < 0 ? 'deficit' : 'surplus'})
                    </span>
                  )}
                </span>
                <button className="btn btn--ghost" onClick={() => set({ calorie_target: Math.round(recommended) })}>
                  Apply
                </button>
              </div>
            )}
            <p className="goals__grams muted">
              Logging steps/exercise? Keep activity at "Sedentary" so burned calories aren't counted twice.
            </p>
          </>
        )}
      </div>

      {save.isError && <p className="error-text">Couldn't save targets. Try again.</p>}

      <button className="btn btn--primary" disabled={!pctOk || !calorieOk || save.isPending} onClick={() => save.mutate(form)}>
        {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved ✓' : 'Save goals'}
      </button>
    </div>
  )
}
