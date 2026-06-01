import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { UnitToggle } from '../components/UnitToggle'
import { getEntriesRange } from '../api/entries'
import { getMetrics } from '../api/metrics'
import { getTargets } from '../api/targets'
import { ATWATER } from '../lib/targets'
import { ema, movingAverage } from '../lib/stats'
import { formatShortDay, lastNDays } from '../lib/date'
import { kgToDisplay, useWeightUnit } from '../lib/units'

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

/** Recharts v3's click state carries the active index (not a payload); map it to a day key. */
function activeDayKey(state: unknown, data: ReadonlyArray<{ dayKey: string }>): string | undefined {
  const idx = (state as { activeTooltipIndex?: number | string | null } | null)?.activeTooltipIndex
  const n = typeof idx === 'string' ? Number(idx) : idx
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < data.length ? data[n].dayKey : undefined
}

interface Props {
  goToDay: (day: string) => void // open a specific day on the Log tab
}

export function TrendsPage({ goToDay }: Props) {
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
        dayKey: day,
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
      dayKey: r.date,
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

      <p className="muted trends__hint">Tap a day on a chart to open it.</p>

      <div className="card chart-card">
        <h3 className="chart-card__title">Calories by macro</h3>
        {hasEntries ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={calData}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              onClick={(state) => {
                const dk = activeDayKey(state, calData)
                if (dk) goToDay(dk)
              }}
            >
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
            <LineChart
              data={weightData}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              onClick={(state) => {
                const dk = activeDayKey(state, weightData)
                if (dk) goToDay(dk)
              }}
            >
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
