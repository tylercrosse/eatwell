import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  CartesianGrid,
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
import { NumberField } from '../components/NumberField'
import { UnitToggle } from '../components/UnitToggle'
import { getEntriesRange } from '../api/entries'
import { getMetrics, postMetric } from '../api/metrics'
import { getTargets } from '../api/targets'
import { ATWATER } from '../lib/targets'
import { ema, movingAverage } from '../lib/stats'
import { formatShortDay, lastNDays, localDayKey } from '../lib/date'
import { displayToKg, kgToDisplay, useWeightUnit, type WeightUnit } from '../lib/units'
import type { MetricCreate } from '../types'

const RANGES = [7, 30, 90] as const
const MA_WINDOW = 7
const WEIGHT_EMA_ALPHA = 0.3 // smoothing for the scale-weight trend line

const COLORS = {
  protein: '#60a5fa',
  carbs: '#fbbf24',
  fat: '#f472b6',
  accent: '#34d399',
  muted: '#94a3b8',
  grid: '#334155',
}
const TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
}
const AXIS_TICK = { fill: COLORS.muted, fontSize: 11 }

const round1 = (n: number) => Math.round(n * 10) / 10

export function TrendsPage() {
  const [unit, setUnit] = useWeightUnit()
  const [days, setDays] = useState<number>(30)

  const axis = useMemo(() => lastNDays(days), [days])
  const from = axis[0]
  const to = axis[axis.length - 1]

  const entriesQuery = useQuery({
    queryKey: ['entries-range', from, to],
    queryFn: () => getEntriesRange(from, to),
  })
  const metricsQuery = useQuery({ queryKey: ['metrics', from, to], queryFn: () => getMetrics(from, to) })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })

  // Calories per day, split by macro contribution (kcal), with a 7-day total-calorie average.
  const calData = useMemo(() => {
    const byDate = new Map((entriesQuery.data ?? []).map((d) => [d.date, d]))
    const totals = axis.map((day) => byDate.get(day)?.total_calories ?? 0)
    const ma = movingAverage(totals, MA_WINDOW)
    return axis.map((day, i) => {
      const d = byDate.get(day)
      return {
        date: formatShortDay(day),
        Protein: Math.round((d?.total_protein_g ?? 0) * ATWATER.protein),
        Carbs: Math.round((d?.total_carbs_g ?? 0) * ATWATER.carbs),
        Fat: Math.round((d?.total_fat_g ?? 0) * ATWATER.fat),
        avg: ma[i] == null ? null : Math.round(ma[i] as number),
      }
    })
  }, [entriesQuery.data, axis])

  // Weight + body-fat over logged days; EMA-smoothed weight trend (scale weight is noisy).
  const weightData = useMemo(() => {
    const rows = metricsQuery.data ?? []
    const withWeight = rows.filter((r) => r.weight_kg != null)
    const emaSeries = ema(withWeight.map((r) => r.weight_kg as number), WEIGHT_EMA_ALPHA)
    const emaByDate = new Map(withWeight.map((r, i) => [r.date, emaSeries[i]]))
    return rows.map((r) => ({
      date: formatShortDay(r.date),
      weight: r.weight_kg == null ? null : round1(kgToDisplay(r.weight_kg, unit)),
      trend: emaByDate.has(r.date) ? round1(kgToDisplay(emaByDate.get(r.date) as number, unit)) : null,
      bodyFat: r.body_fat_pct,
    }))
  }, [metricsQuery.data, unit])

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

      <WeightLogCard unit={unit} />

      <div className="card chart-card">
        <h3 className="chart-card__title">Calories by macro</h3>
        {hasEntries ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={calData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={COLORS.grid} strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: COLORS.grid }} minTickGap={24} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Protein" stackId="m" fill={COLORS.protein} />
              <Bar dataKey="Carbs" stackId="m" fill={COLORS.carbs} />
              <Bar dataKey="Fat" stackId="m" fill={COLORS.fat} radius={[3, 3, 0, 0]} />
              <Line dataKey="avg" name={`${MA_WINDOW}-day avg`} stroke={COLORS.accent} strokeWidth={2} dot={false} connectNulls />
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
        <h3 className="chart-card__title">Weight &amp; body fat</h3>
        {hasWeight ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weightData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={COLORS.grid} strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: COLORS.grid }} minTickGap={24} />
              <YAxis yAxisId="w" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
              <YAxis yAxisId="bf" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} domain={['auto', 'auto']} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="w" dataKey="weight" name={`Weight (${unit})`} stroke={COLORS.muted} strokeWidth={1} dot={{ r: 2 }} connectNulls />
              <Line yAxisId="w" dataKey="trend" name="Trend" stroke={COLORS.accent} strokeWidth={2.5} dot={false} connectNulls />
              <Line yAxisId="bf" dataKey="bodyFat" name="Body fat %" stroke={COLORS.fat} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted chart-card__empty">Log your weight to see the trend.</p>
        )}
      </div>
    </div>
  )
}

function WeightLogCard({ unit }: { unit: WeightUnit }) {
  const queryClient = useQueryClient()
  const today = localDayKey()
  const [date, setDate] = useState<string>(today)
  const [weight, setWeight] = useState<number | null>(null)
  const [bodyFat, setBodyFat] = useState<number | null>(null)

  const save = useMutation({
    mutationFn: postMetric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      setWeight(null) // keep `date` so backfilling consecutive days stays quick
      setBodyFat(null)
    },
  })

  const canSave = weight != null || bodyFat != null

  function submit() {
    // Only include fields the user filled — the upsert preserves the day's other value.
    const payload: MetricCreate = { date }
    if (weight != null) payload.weight_kg = displayToKg(weight, unit)
    if (bodyFat != null) payload.body_fat_pct = bodyFat
    save.mutate(payload)
  }

  return (
    <div className="card">
      <h3 className="chart-card__title">Log weight</h3>
      <label className="field">
        <span className="field__label">Date</span>
        <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value || today)} />
      </label>
      <div className="macros">
        <NumberField label="Weight" unit={unit} min={0} value={weight} onChange={setWeight} />
        <NumberField label="Body fat" unit="%" min={0} value={bodyFat} onChange={setBodyFat} />
      </div>
      {save.isError && <p className="error-text">Couldn't save. Try again.</p>}
      <button className="btn btn--primary" disabled={!canSave || save.isPending} onClick={submit}>
        {save.isPending
          ? 'Saving…'
          : save.isSuccess && !canSave
            ? 'Saved ✓'
            : date === today
              ? 'Log weight'
              : `Log for ${date}`}
      </button>
    </div>
  )
}
