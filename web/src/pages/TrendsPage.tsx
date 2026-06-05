import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { UnitToggle } from '../components/UnitToggle'
import { getEntriesRange } from '../api/entries'
import { getExerciseRange } from '../api/exercise'
import { getMetrics } from '../api/metrics'
import { getTargets } from '../api/targets'
import { ATWATER } from '../lib/targets'
import { expenditureBreakdown } from '../lib/energy'
import { stepsToKcal } from '../lib/activity'
import { KCAL_PER_KG } from '../lib/tdee'
import { ema, movingAverage } from '../lib/stats'
import { daysBetween, formatShortDay, lastNDays } from '../lib/date'
import { kgToDisplay, useWeightUnit } from '../lib/units'
import { round1 } from '../lib/totals'

const RANGES = [7, 30, 90] as const
const MA_WINDOW = 7
const WEIGHT_EMA_ALPHA = 0.3 // smoothing for the scale-weight trend line

const COLORS = {
  protein: '#60a5fa',
  carbs: '#fbbf24',
  fat: '#f472b6',
  accent: '#34d399',
  goal: '#a78bfa',
  burn: '#fb923c', // expenditure + the energy-balance predicted-weight line
  deficit: '#34d399', // net < 0 (losing) — green
  surplus: '#f87171', // net > 0 (gaining) — red
  muted: '#94a3b8',
  grid: '#334155',
}
const TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
}
const AXIS_TICK = { fill: COLORS.muted, fontSize: 11 }

/** Recharts v3's click state carries the active index (not a payload); map it to a day key. */
function activeDayKey(state: unknown, data: ReadonlyArray<{ dayKey: string }>): string | undefined {
  const idx = (state as { activeTooltipIndex?: number | string | null } | null)?.activeTooltipIndex
  const n = typeof idx === 'string' ? Number(idx) : idx
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < data.length ? data[n].dayKey : undefined
}

/** Signed, thousands-grouped number for the energy-balance readout (e.g. "+1,200", "−320"). */
function signed(n: number): string {
  const r = Math.round(n)
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toLocaleString()}`
}

interface Props {
  goToDay: (day: string) => void // open a specific day on the Log tab
}

export function TrendsPage({ goToDay }: Props) {
  const [unit, setUnit] = useWeightUnit()
  const [days, setDays] = useState<number>(30)
  const currentYear = new Date().getFullYear()

  const axis = useMemo(() => lastNDays(days), [days])
  const from = axis[0]
  const to = axis[axis.length - 1]

  const entriesQuery = useQuery({
    queryKey: ['entries-range', from, to],
    queryFn: () => getEntriesRange(from, to),
  })
  const exerciseQuery = useQuery({
    queryKey: ['exercise-range', from, to],
    queryFn: () => getExerciseRange(from, to),
  })
  const metricsQuery = useQuery({ queryKey: ['metrics', from, to], queryFn: () => getMetrics(from, to) })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })

  // Per-day total energy expenditure (BMR + baseline activity + exercise + step burn), keyed by day.
  // Weight is forward-filled across the axis (BMR needs a weight every day, but weigh-ins are sparse);
  // before the first weigh-in we back-fill the earliest one. `available` is false when the profile is
  // incomplete (no height/birth-year/sex) — the expenditure-derived features then stay hidden.
  const expenditure = useMemo(() => {
    const t = targetsQuery.data
    const metrics = metricsQuery.data ?? []
    const exByDate = new Map((exerciseQuery.data ?? []).map((d) => [d.date, d.total_calories]))
    const metricByDate = new Map(metrics.map((m) => [m.date, m]))
    const loggedWeights = metrics.filter((m) => m.weight_kg != null)

    const byDay = new Map<string, number>()
    let available = false
    let carriedWeight = loggedWeights.length ? (loggedWeights[0].weight_kg as number) : null
    for (const dk of axis) {
      const m = metricByDate.get(dk)
      if (m?.weight_kg != null) carriedWeight = m.weight_kg
      const exerciseKcal = (exByDate.get(dk) ?? 0) + stepsToKcal(m?.steps, carriedWeight)
      const b = expenditureBreakdown({
        weightKg: carriedWeight,
        heightCm: t?.height_cm,
        birthYear: t?.birth_year,
        sex: t?.sex,
        activityFactor: t?.activity_factor,
        exerciseKcal,
        currentYear,
      })
      if (b) {
        byDay.set(dk, b.total)
        available = true
      }
    }
    return { byDay, available }
  }, [targetsQuery.data, metricsQuery.data, exerciseQuery.data, axis, currentYear])

  // Calories per day, split by macro contribution (kcal), with a 7-day total-calorie average and
  // (when the profile is complete) an expenditure line — the gap above the bars is the day's balance.
  const calData = useMemo(() => {
    const byDate = new Map((entriesQuery.data ?? []).map((d) => [d.date, d]))
    const totals = axis.map((day) => byDate.get(day)?.total_calories ?? 0)
    const ma = movingAverage(totals, MA_WINDOW)
    return axis.map((day, i) => {
      const d = byDate.get(day)
      const exp = expenditure.byDay.get(day)
      return {
        dayKey: day,
        date: formatShortDay(day),
        Protein: Math.round((d?.total_protein_g ?? 0) * ATWATER.protein),
        Carbs: Math.round((d?.total_carbs_g ?? 0) * ATWATER.carbs),
        Fat: Math.round((d?.total_fat_g ?? 0) * ATWATER.fat),
        avg: ma[i] == null ? null : Math.round(ma[i] as number),
        expenditure: exp == null ? null : Math.round(exp),
      }
    })
  }, [entriesQuery.data, axis, expenditure])

  // Daily net energy (consumed − expenditure) + a running cumulative, for the energy-balance chart.
  // Only days with logged intake count — an unlogged day is a gap, never a phantom full-day deficit.
  const balanceData = useMemo(() => {
    const byDate = new Map((entriesQuery.data ?? []).map((d) => [d.date, d]))
    const rows: { dayKey: string; date: string; net: number | null; cumNet: number | null }[] = []
    let cum = 0
    let netKcal = 0
    let started = false
    for (const dk of axis) {
      const d = byDate.get(dk)
      const exp = expenditure.byDay.get(dk)
      let net: number | null = null
      if (d != null && d.entry_count > 0 && exp != null) {
        net = d.total_calories - exp
        cum += net
        netKcal += net
        started = true
      }
      rows.push({
        dayKey: dk,
        date: formatShortDay(dk),
        net: net == null ? null : Math.round(net),
        cumNet: started ? Math.round(cum) : null,
      })
    }
    return {
      rows,
      netKcal,
      predictedKg: round1(kgToDisplay(netKcal / KCAL_PER_KG, unit)),
      hasData: expenditure.available && rows.some((r) => r.net != null),
    }
  }, [entriesQuery.data, axis, expenditure, unit])

  // Weight + body-fat on the same daily axis as the calories chart. Actuals + EMA trend, a dashed
  // goal-pace projection drawn forward from the LAST logged weight at the goal rate (clamped at the
  // goal; body fat glides to its goal over the same timeline), and a dashed "Predicted (balance)"
  // line: anchored at the FIRST logged weight, each logged-intake day adds (consumed − expenditure)/7700.
  const weightData = useMemo(() => {
    const metrics = metricsQuery.data ?? []
    const byDate = new Map(metrics.map((m) => [m.date, m]))
    const logged = metrics.filter((m) => m.weight_kg != null)
    const emaVals = ema(logged.map((m) => m.weight_kg as number), WEIGHT_EMA_ALPHA)
    const emaByDate = new Map(logged.map((m, i) => [m.date, emaVals[i]]))

    const t = targetsQuery.data
    const last = logged.length ? logged[logged.length - 1] : null
    const currentKg = last?.weight_kg ?? null
    const anchorWeightDate = last?.date ?? null
    const goalKg = t?.goal_weight_kg ?? null
    const magKg = Math.abs(t?.weekly_rate_kg ?? 0)
    const dir = goalKg != null && currentKg != null && magKg > 0 ? Math.sign(goalKg - currentKg) : 0
    const dailyKg = (dir * magKg) / 7

    const lastBf = [...metrics].reverse().find((m) => m.body_fat_pct != null) ?? null
    const currentBf = lastBf?.body_fat_pct ?? null
    const anchorBfDate = lastBf?.date ?? null
    const goalBf = t?.goal_body_fat_pct ?? null
    const daysToGoal = dir !== 0 ? (Math.abs((goalKg as number) - (currentKg as number)) / magKg) * 7 : 0
    const bfDaily =
      dir !== 0 && goalBf != null && currentBf != null && daysToGoal > 0 ? (goalBf - currentBf) / daysToGoal : null

    // Predicted-weight (energy balance): anchor at the first logged weigh-in in range.
    const entriesByDate = new Map((entriesQuery.data ?? []).map((d) => [d.date, d]))
    const first = logged.length ? logged[0] : null
    const predAnchorKg = first?.weight_kg ?? null
    const predAnchorDate = first?.date ?? null
    const hasPrediction = expenditure.available && predAnchorKg != null && predAnchorDate != null
    type WeightRow = {
      dayKey: string
      date: string
      weight: number | null
      trend: number | null
      bodyFat: number | null
      projWeight: number | null
      projBodyFat: number | null
      predWeight: number | null
    }
    const rows: WeightRow[] = []
    let predCum = 0 // cumulative net kcal since the anchor weigh-in
    for (const dk of axis) {
      const m = byDate.get(dk)
      let projWeight: number | null = null
      if (dir !== 0 && currentKg != null && goalKg != null && anchorWeightDate != null && dk >= anchorWeightDate) {
        const raw = currentKg + dailyKg * daysBetween(anchorWeightDate, dk)
        projWeight = round1(kgToDisplay(dir < 0 ? Math.max(goalKg, raw) : Math.min(goalKg, raw), unit))
      }
      let projBodyFat: number | null = null
      if (bfDaily != null && currentBf != null && goalBf != null && anchorBfDate != null && dk >= anchorBfDate) {
        const raw = currentBf + bfDaily * daysBetween(anchorBfDate, dk)
        projBodyFat = round1(bfDaily < 0 ? Math.max(goalBf, raw) : Math.min(goalBf, raw))
      }
      let predWeight: number | null = null
      if (hasPrediction && predAnchorDate != null && dk >= predAnchorDate) {
        const d = entriesByDate.get(dk)
        const exp = expenditure.byDay.get(dk)
        if (dk > predAnchorDate && d != null && d.entry_count > 0 && exp != null) {
          predCum += d.total_calories - exp
        }
        predWeight = round1(kgToDisplay((predAnchorKg as number) + predCum / KCAL_PER_KG, unit))
      }
      rows.push({
        dayKey: dk,
        date: formatShortDay(dk),
        weight: m?.weight_kg == null ? null : round1(kgToDisplay(m.weight_kg, unit)),
        trend: emaByDate.has(dk) ? round1(kgToDisplay(emaByDate.get(dk) as number, unit)) : null,
        bodyFat: m?.body_fat_pct ?? null,
        projWeight,
        projBodyFat,
        predWeight,
      })
    }
    return { rows, hasProjection: dir !== 0, hasPrediction }
  }, [metricsQuery.data, targetsQuery.data, entriesQuery.data, expenditure, unit, axis])

  const hasEntries = (entriesQuery.data?.length ?? 0) > 0
  const hasWeight = (metricsQuery.data ?? []).some((r) => r.weight_kg != null)
  const target = targetsQuery.data?.calorie_target

  return (
    <div className="page trends">
      <div className="trends__bar">
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`seg__btn ${days === r ? 'is-active' : ''}`}
              onClick={() => setDays(r)}
            >
              {r}d
            </button>
          ))}
        </div>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>

      <p className="muted trends__hint">Tap a day on a chart to open it.</p>

      <div className="card chart-card">
        <h3 className="chart-card__title">Calories by macro</h3>
        {hasEntries ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={calData}
              margin={{ top: 8, right: 40, bottom: 0, left: 0 }}
              onClick={(state) => {
                const dk = activeDayKey(state, calData)
                if (dk) goToDay(dk)
              }}
            >
              <CartesianGrid stroke={COLORS.grid} strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: COLORS.grid }} minTickGap={24} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Protein" stackId="m" fill={COLORS.protein} />
              <Bar dataKey="Carbs" stackId="m" fill={COLORS.carbs} />
              <Bar dataKey="Fat" stackId="m" fill={COLORS.fat} radius={[3, 3, 0, 0]} />
              <Line dataKey="avg" name={`${MA_WINDOW}-day avg`} stroke={COLORS.accent} strokeWidth={2} dot={false} connectNulls />
              {expenditure.available && (
                <Line dataKey="expenditure" name="Expenditure" stroke={COLORS.burn} strokeWidth={2} dot={false} connectNulls />
              )}
              {target ? (
                <ReferenceLine
                  y={target}
                  stroke={COLORS.muted}
                  strokeDasharray="4 4"
                  label={{ value: 'target', fill: COLORS.muted, fontSize: 10, position: 'insideTopRight' }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted chart-card__empty">No entries in this range yet.</p>
        )}
      </div>

      <div className="card chart-card">
        <h3 className="chart-card__title">Energy balance</h3>
        {balanceData.hasData ? (
          <>
            <p className="chart-card__readout">
              Net <strong>{signed(balanceData.netKcal)} kcal</strong> over {days}d ·{' '}
              <strong>≈ {signed(balanceData.predictedKg)} {unit}</strong> expected
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={balanceData.rows}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                onClick={(state) => {
                  const dk = activeDayKey(state, balanceData.rows)
                  if (dk) goToDay(dk)
                }}
              >
                <CartesianGrid stroke={COLORS.grid} strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: COLORS.grid }} minTickGap={24} />
                <YAxis yAxisId="net" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
                <YAxis yAxisId="cum" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="net" y={0} stroke={COLORS.muted} />
                <Bar yAxisId="net" dataKey="net" name="Net (kcal)">
                  {balanceData.rows.map((r) => (
                    <Cell key={r.dayKey} fill={(r.net ?? 0) < 0 ? COLORS.deficit : COLORS.surplus} />
                  ))}
                </Bar>
                <Line yAxisId="cum" dataKey="cumNet" name="Cumulative" stroke={COLORS.goal} strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="muted chart-card__empty">
            Add your profile (height, age, sex) plus food and exercise to see your energy balance.
          </p>
        )}
      </div>

      <div className="card chart-card">
        <h3 className="chart-card__title">Weight &amp; body fat</h3>
        {hasWeight ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={weightData.rows}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              onClick={(state) => {
                const dk = activeDayKey(state, weightData.rows)
                if (dk) goToDay(dk)
              }}
            >
              <CartesianGrid stroke={COLORS.grid} strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: COLORS.grid }} minTickGap={24} />
              <YAxis yAxisId="w" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} tickFormatter={(v) => `${Math.round(Number(v) * 10) / 10}`} />
              <YAxis yAxisId="bf" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} domain={['auto', 'auto']} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="w" dataKey="weight" name={`Weight (${unit})`} stroke={COLORS.muted} strokeWidth={1} dot={{ r: 2 }} connectNulls />
              <Line yAxisId="w" dataKey="trend" name="Trend" stroke={COLORS.accent} strokeWidth={2.5} dot={false} connectNulls />
              {weightData.hasPrediction && (
                <Line yAxisId="w" dataKey="predWeight" name="Predicted (balance)" stroke={COLORS.burn} strokeWidth={2} strokeDasharray="2 3" dot={false} connectNulls />
              )}
              {weightData.hasProjection && (
                <Line yAxisId="w" dataKey="projWeight" name="Goal pace" stroke={COLORS.goal} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
              )}
              <Line yAxisId="bf" dataKey="bodyFat" name="Body fat %" stroke={COLORS.fat} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
              {weightData.hasProjection && (
                <Line yAxisId="bf" dataKey="projBodyFat" name="BF goal" stroke={COLORS.fat} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted chart-card__empty">Log your weight to see the trend.</p>
        )}
      </div>
    </div>
  )
}
