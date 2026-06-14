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
import { GoalProgressTrack, type GoalMetric } from '../components/GoalProgress'
import { getEntriesRange } from '../api/entries'
import { getExerciseRange } from '../api/exercise'
import { getMetrics } from '../api/metrics'
import { getTargets } from '../api/targets'
import { ATWATER, signedWeeklyRateKg } from '../lib/targets'
import { expenditureBreakdown, balanceColor } from '../lib/energy'
import { MACRO_ORDER, NUTRITION_DISPLAY, type MacroKey } from '../lib/nutritionDisplay'
import { stepsToKcal } from '../lib/activity'
import { KCAL_PER_KG } from '../lib/tdee'
import { ema, movingAverage } from '../lib/stats'
import { daysBetween, formatFullDay, formatShortDay, lastNDays, localDayKey, shiftDay } from '../lib/date'
import { kgToDisplay, useWeightUnit } from '../lib/units'
import { round1 } from '../lib/totals'
import { useChartColors } from '../lib/theme'

const RANGES = [7, 30, 90] as const
const MA_WINDOW = 7
const WEIGHT_EMA_ALPHA = 0.3 // smoothing for the scale-weight trend line
const METRICS_LOOKBACK_DAYS = 730 // weigh-ins always load on this fixed lookback, not the range selector

const macroChartKey = (key: MacroKey) => NUTRITION_DISPLAY[key].label

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

/** Same, but keeps one decimal — for kg/lb (e.g. "+1.6", "−0.4"). */
function signed1(n: number): string {
  const r = round1(n)
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}`
}

interface Props {
  goToDay: (day: string) => void // open a specific day on the Log tab
}

export function TrendsPage({ goToDay }: Props) {
  const C = useChartColors()
  const TOOLTIP = {
    contentStyle: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: C.muted },
    itemStyle: { color: C.text },
  }
  const AXIS_TICK = { fill: C.muted, fontSize: 11 }
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
  // Weigh-ins load on a fixed lookback, NOT the selected range, so the latest weight is always
  // available even when it predates a short window — the range only zooms the time-series x-axes.
  const metricsFrom = useMemo(() => shiftDay(to, -METRICS_LOOKBACK_DAYS), [to])
  const metricsQuery = useQuery({ queryKey: ['metrics', metricsFrom, to], queryFn: () => getMetrics(metricsFrom, to) })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })

  // Weight baseline from the full weigh-in history (range-independent): the weight at the window
  // start (forward-filled, since weigh-ins are sparse) plus the earliest and latest on record. This
  // is what lets the weight / expenditure / goal charts work when the last weigh-in predates a short
  // window — the predicted line then anchors at the window-start weight and accrues the window's net.
  const baseline = useMemo(() => {
    const loggedW = (metricsQuery.data ?? []).filter((m) => m.weight_kg != null)
    const onBefore = loggedW.filter((m) => m.date <= from)
    const windowStartKg = onBefore.length
      ? (onBefore[onBefore.length - 1].weight_kg as number)
      : loggedW.length
        ? (loggedW[0].weight_kg as number)
        : null
    return {
      windowStartKg,
      firstKg: loggedW.length ? (loggedW[0].weight_kg as number) : null,
      latestKg: loggedW.length ? (loggedW[loggedW.length - 1].weight_kg as number) : null,
    }
  }, [metricsQuery.data, from])

  // Per-day total energy expenditure (BMR + baseline activity + exercise + step burn), keyed by day.
  // Weight is forward-filled across the axis (BMR needs a weight every day, but weigh-ins are sparse):
  // seed with the weight at the window start, then carry the latest in-window weigh-in forward.
  // `available` is false when the profile is incomplete (no height/birth-year/sex) or there's no
  // weight on record — the expenditure-derived features then stay hidden.
  const expenditure = useMemo(() => {
    const t = targetsQuery.data
    const exByDate = new Map((exerciseQuery.data ?? []).map((d) => [d.date, d.total_calories]))
    const metricByDate = new Map((metricsQuery.data ?? []).map((m) => [m.date, m]))

    const byDay = new Map<string, number>()
    let available = false
    let carriedWeight = baseline.windowStartKg // weight at the window start, forward-filled below
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
  }, [targetsQuery.data, metricsQuery.data, exerciseQuery.data, baseline, axis, currentYear])

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
        Fat: Math.round((d?.total_fat_g ?? 0) * ATWATER.fat),
        Carbs: Math.round((d?.total_carbs_g ?? 0) * ATWATER.carbs),
        avg: ma[i] == null ? null : Math.round(ma[i] as number),
        expenditure: exp == null ? null : Math.round(exp),
      }
    })
  }, [entriesQuery.data, axis, expenditure])

  // Daily balance (consumed − expenditure) + a running cumulative, for the energy-balance chart. Only
  // days with logged intake count — an unlogged day is a gap, never a phantom full-day deficit. The
  // goal daily balance (from the goal's weekly rate) is what each bar is colored against.
  const balanceData = useMemo(() => {
    const byDate = new Map((entriesQuery.data ?? []).map((d) => [d.date, d]))
    const metrics = metricsQuery.data ?? []
    const lastWeightKg = [...metrics].reverse().find((m) => m.weight_kg != null)?.weight_kg ?? null
    const swr = targetsQuery.data ? signedWeeklyRateKg(targetsQuery.data, lastWeightKg) : null
    const goalDailyKcal = swr == null ? null : (swr * KCAL_PER_KG) / 7

    const rows: { dayKey: string; date: string; net: number | null; cumNet: number | null }[] = []
    let cum = 0
    let netKcal = 0
    let loggedDays = 0
    let started = false
    for (const dk of axis) {
      const d = byDate.get(dk)
      const exp = expenditure.byDay.get(dk)
      let net: number | null = null
      if (d != null && d.entry_count > 0 && exp != null) {
        net = d.total_calories - exp
        cum += net
        netKcal += net
        loggedDays += 1
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
      loggedDays,
      goalDailyKcal,
      predictedKg: round1(kgToDisplay(netKcal / KCAL_PER_KG, unit)),
      hasData: expenditure.available && loggedDays > 0,
    }
  }, [entriesQuery.data, metricsQuery.data, targetsQuery.data, axis, expenditure, unit])

  // Weight + body-fat on the same daily axis as the calories chart. Actuals + EMA trend, a dashed
  // goal-pace projection drawn forward from the LAST logged weight at the goal rate (clamped at the
  // goal; body fat glides to its goal over the same timeline), and a dashed "Predicted" line:
  // anchored at the window-start weight, adding the running energy balance (Σ net / 7700).
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

    // Predicted-weight line: from the weight at the window start, add the running energy balance
    // (Σ net / 7700) — the same cumulative the energy-balance chart plots, mapped onto the scale.
    const windowStartKg = baseline.windowStartKg
    const cumByDay = new Map(balanceData.rows.map((r) => [r.dayKey, r.cumNet]))
    const hasPrediction = expenditure.available && windowStartKg != null
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
      if (hasPrediction) {
        predWeight = round1(kgToDisplay((windowStartKg as number) + (cumByDay.get(dk) ?? 0) / KCAL_PER_KG, unit))
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
    const hasBodyFat = metrics.some((m) => m.body_fat_pct != null)
    return { rows, hasProjection: dir !== 0, hasPrediction, hasBodyFat }
  }, [metricsQuery.data, targetsQuery.data, balanceData, baseline, expenditure, unit, axis])

  // Weight forecast: the same weight/body-fat picture, but the axis runs from the past window out to
  // the goal-pace finish date. Past = actuals + EMA trend (as in the weight chart). Future = the two
  // projections continued to the goal: "Goal pace" at the target rate, "Predicted" at the recent
  // average daily balance — so you can see both lines converge on (or miss) the goal line, and when.
  const forecastData = useMemo(() => {
    const metrics = metricsQuery.data ?? []
    const t = targetsQuery.data
    const byDate = new Map(metrics.map((m) => [m.date, m]))
    const loggedW = metrics.filter((m) => m.weight_kg != null)
    const emaVals = ema(loggedW.map((m) => m.weight_kg as number), WEIGHT_EMA_ALPHA)
    const emaByDate = new Map(loggedW.map((m, i) => [m.date, emaVals[i]]))

    const last = loggedW.length ? loggedW[loggedW.length - 1] : null
    const currentKg = last?.weight_kg ?? null
    const anchorWeightDate = last?.date ?? null
    const goalKg = t?.goal_weight_kg ?? null
    const magKg = Math.abs(t?.weekly_rate_kg ?? 0)
    const dir = goalKg != null && currentKg != null && magKg > 0 ? Math.sign(goalKg - currentKg) : 0
    const dailyKg = (dir * magKg) / 7
    const clampGoal = (raw: number) => (dir < 0 ? Math.max(goalKg as number, raw) : Math.min(goalKg as number, raw))
    // The target rate spelled out, in the active unit (e.g. "lose 1.5 lb/wk"). kgToDisplay is linear,
    // so it converts a kg/wk rate the same way it converts a weight.
    const paceLabel = dir !== 0 ? `${dir < 0 ? 'lose' : 'gain'} ${round1(kgToDisplay(magKg, unit))} ${unit}/wk` : null

    const todayKey = localDayKey()
    // Goal-pace ETA sets the future horizon (bounded by the target rate; capped at ~2y for safety).
    let futureDays = 0
    let goalDateKey: string | null = null
    if (dir !== 0 && currentKg != null && goalKg != null && anchorWeightDate != null) {
      const daysToGoal = Math.ceil((Math.abs(goalKg - currentKg) / magKg) * 7)
      goalDateKey = shiftDay(anchorWeightDate, daysToGoal)
      futureDays = Math.min(Math.max(daysBetween(todayKey, goalDateKey), 0), 730)
    }
    const axisF: string[] = []
    for (let i = -(days - 1); i <= futureDays; i++) axisF.push(shiftDay(todayKey, i))

    // Body-fat glide to its goal over the same weight-goal timeline.
    const lastBf = [...metrics].reverse().find((m) => m.body_fat_pct != null) ?? null
    const currentBf = lastBf?.body_fat_pct ?? null
    const anchorBfDate = lastBf?.date ?? null
    const goalBf = t?.goal_body_fat_pct ?? null
    const daysToGoalBf = dir !== 0 ? (Math.abs((goalKg as number) - (currentKg as number)) / magKg) * 7 : 0
    const bfDaily =
      dir !== 0 && goalBf != null && currentBf != null && daysToGoalBf > 0 ? (goalBf - currentBf) / daysToGoalBf : null

    // Predicted (energy balance): past = window-start weight + running net (reusing the balance
    // chart's cumulative); future = extrapolate at the recent average daily net.
    const windowStartKg = baseline.windowStartKg
    const cumByDay = new Map(balanceData.rows.map((r) => [r.dayKey, r.cumNet]))
    const hasPrediction = expenditure.available && windowStartKg != null
    const predNowKg = windowStartKg != null ? windowStartKg + balanceData.netKcal / KCAL_PER_KG : null
    const avgDailyKg = balanceData.loggedDays > 0 ? balanceData.netKcal / balanceData.loggedDays / KCAL_PER_KG : 0

    type ForecastRow = {
      dayKey: string
      date: string
      weight: number | null
      trend: number | null
      bodyFat: number | null
      projWeight: number | null
      projBodyFat: number | null
      predWeight: number | null
    }
    const rows: ForecastRow[] = []
    for (const dk of axisF) {
      const m = byDate.get(dk)
      const isFuture = dk > todayKey

      let projWeight: number | null = null
      if (dir !== 0 && currentKg != null && goalKg != null && anchorWeightDate != null && dk >= anchorWeightDate) {
        projWeight = round1(kgToDisplay(clampGoal(currentKg + dailyKg * daysBetween(anchorWeightDate, dk)), unit))
      }
      let projBodyFat: number | null = null
      if (bfDaily != null && currentBf != null && goalBf != null && anchorBfDate != null && dk >= anchorBfDate) {
        const raw = currentBf + bfDaily * daysBetween(anchorBfDate, dk)
        projBodyFat = round1(bfDaily < 0 ? Math.max(goalBf, raw) : Math.min(goalBf, raw))
      }
      let predWeight: number | null = null
      if (hasPrediction && !isFuture) {
        predWeight = round1(kgToDisplay((windowStartKg as number) + (cumByDay.get(dk) ?? 0) / KCAL_PER_KG, unit))
      } else if (hasPrediction && isFuture && predNowKg != null) {
        const raw = predNowKg + avgDailyKg * daysBetween(todayKey, dk)
        predWeight = round1(kgToDisplay(dir !== 0 ? clampGoal(raw) : raw, unit))
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

    // ETA at the recent intake pace — only if you're actually moving toward the goal.
    let predGoalKey: string | null = null
    if (hasPrediction && predNowKg != null && goalKg != null && dir !== 0 && Math.sign(avgDailyKg) === dir && avgDailyKg !== 0) {
      const predDays = Math.ceil(Math.abs(goalKg - predNowKg) / Math.abs(avgDailyKg))
      predGoalKey = shiftDay(todayKey, Math.min(predDays, 3650))
    }

    return {
      rows,
      hasProjection: dir !== 0,
      hasPrediction,
      hasBodyFat: metrics.some((m) => m.body_fat_pct != null),
      paceLabel,
      goalDisplay: goalKg != null ? round1(kgToDisplay(goalKg, unit)) : null,
      goalDateLabel: goalDateKey ? formatFullDay(goalDateKey) : null,
      predGoalLabel: predGoalKey ? formatFullDay(predGoalKey) : null,
      todayLabel: formatShortDay(todayKey),
    }
  }, [metricsQuery.data, targetsQuery.data, expenditure, balanceData, baseline, unit, days])

  // Goal progress on each metric's own scale (non-date x-axis), range-independent. start = earliest
  // weigh-in on record, now = latest, predicted = the window-start weight plus the window's energy
  // balance (Σ net / 7700) — a predicted "now". All in the active weight unit.
  const goalProgress = useMemo(() => {
    const metrics = metricsQuery.data ?? []
    const t = targetsQuery.data
    const loggedW = metrics.filter((m) => m.weight_kg != null)
    const loggedBf = metrics.filter((m) => m.body_fat_pct != null)
    const disp = (kg: number) => round1(kgToDisplay(kg, unit))

    const startKg = loggedW.length ? (loggedW[0].weight_kg as number) : null
    const nowKg = loggedW.length ? (loggedW[loggedW.length - 1].weight_kg as number) : null
    const goalKg = t?.goal_weight_kg ?? null
    const predKg =
      baseline.windowStartKg != null && expenditure.available ? baseline.windowStartKg + balanceData.netKcal / KCAL_PER_KG : null

    const startBf = loggedBf.length ? (loggedBf[0].body_fat_pct as number) : null
    const nowBf = loggedBf.length ? (loggedBf[loggedBf.length - 1].body_fat_pct as number) : null
    const goalBf = t?.goal_body_fat_pct ?? null

    const metricsOut: GoalMetric[] = []
    if (startKg != null && nowKg != null && goalKg != null) {
      metricsOut.push({
        key: 'weight',
        label: 'Weight',
        unit,
        start: disp(startKg),
        now: disp(nowKg),
        goal: disp(goalKg),
        predicted: predKg != null ? disp(predKg) : null,
      })
    }
    if (startBf != null && nowBf != null && goalBf != null) {
      metricsOut.push({ key: 'bodyfat', label: 'Body fat', unit: '%', start: round1(startBf), now: round1(nowBf), goal: round1(goalBf) })
    }
    return { metrics: metricsOut, hasGoal: metricsOut.length > 0 }
  }, [metricsQuery.data, targetsQuery.data, expenditure, balanceData, baseline, unit])

  const hasEntries = (entriesQuery.data?.length ?? 0) > 0
  const hasWeight = (metricsQuery.data ?? []).some((r) => r.weight_kg != null)
  const target = targetsQuery.data?.calorie_target

  // Tight y-axis for the calories chart: ~200 kcal of headroom above the tallest thing drawn — a
  // day's stacked macro total, the expenditure line, or the intake target — rounded up to 100.
  const calDomainMax = useMemo(() => {
    const peak = calData.reduce((m, r) => Math.max(m, r.Protein + r.Fat + r.Carbs, r.expenditure ?? 0), target ?? 0)
    return peak > 0 ? Math.ceil((peak + 200) / 100) * 100 : 'auto'
  }, [calData, target])

  // recharts' 'auto' pins a y-axis to the exact data min/max with no headroom, so the lowest line —
  // the predicted-weight trend, or the body-fat glide — sits flush on the axis and reads as clipped.
  // This pads both ends: 10% of the data range, with a floor so it still works with one data point.
  const padDomain =
    (floor: number) =>
    ([min, max]: readonly [number, number]): [number, number] => {
      const pad = Math.max((max - min) * 0.1, floor)
      return [round1(min - pad), round1(max + pad)]
    }

  // Color each balance bar relative to the goal balance (green at goal → red as it drifts), matching
  // the Log page's Balance ring. With no goal set we fall back to direction (deficit green / surplus red).
  const goalAware = balanceData.goalDailyKcal != null
  const barColor = (net: number | null): string => {
    if (goalAware && net != null) return balanceColor(net - (balanceData.goalDailyKcal as number)) as string
    return (net ?? 0) < 0 ? C.accent : C.danger
  }

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
              syncId="trends"
              syncMethod="value"
              margin={{ top: 8, right: 60, bottom: 0, left: 0 }}
              onClick={(state) => {
                const dk = activeDayKey(state, calData)
                if (dk) goToDay(dk)
              }}
            >
              <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={[0, calDomainMax]} allowDataOverflow />
              <Tooltip {...TOOLTIP} />
              {/* itemSorter={null} keeps declaration order (Protein, Fat, Carbs, Trend, Expenditure)
                  so the macros stay grouped; the default 'value' sorter alphabetizes and splits them. */}
              <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} />
              {MACRO_ORDER.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={macroChartKey(key)}
                  stackId="m"
                  fill={key === 'fat' ? C.fat : key === 'protein' ? C.protein : C.carbs}
                  legendType="circle"
                  radius={i === MACRO_ORDER.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
              <Line dataKey="avg" name="Trend" stroke={C.accent} strokeWidth={2} dot={false} connectNulls legendType="line" />
              {expenditure.available && (
                <Line
                  dataKey="expenditure"
                  name="Expenditure"
                  stroke={C.expenditure}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  legendType="line"
                />
              )}
              {target ? (
                <ReferenceLine
                  y={target}
                  stroke={C.muted}
                  strokeDasharray="4 4"
                  label={{ value: 'intake target', fill: C.muted, fontSize: 10, position: 'insideTopRight' }}
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
              Balance <strong>{signed(balanceData.netKcal)} kcal</strong> over {balanceData.loggedDays} logged{' '}
              {balanceData.loggedDays === 1 ? 'day' : 'days'} · predicted{' '}
              <strong>≈ {signed1(balanceData.predictedKg)} {unit}</strong>
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={balanceData.rows}
                syncId="trends"
                syncMethod="value"
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                onClick={(state) => {
                  const dk = activeDayKey(state, balanceData.rows)
                  if (dk) goToDay(dk)
                }}
              >
                <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
                <YAxis yAxisId="net" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
                <YAxis yAxisId="cum" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="net" y={0} stroke={C.muted} />
                <Bar yAxisId="net" dataKey="net" name="Balance (kcal)" fill={C.muted}>
                  {balanceData.rows.map((r) => (
                    <Cell key={r.dayKey} fill={barColor(r.net)} />
                  ))}
                </Bar>
                <Line yAxisId="cum" dataKey="cumNet" name="Cumulative" stroke={C.projection} strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="chart-card__note">
              {goalAware
                ? 'Bars: green = on your goal pace, red = off it. Line: running total.'
                : 'Bars: green = deficit (under), red = surplus (over). Line: running total.'}
            </p>
          </>
        ) : (
          <p className="muted chart-card__empty">
            Add your profile (height, age, sex) in Goals and log food to see your energy balance.
          </p>
        )}
      </div>

      <div className="card chart-card">
        <h3 className="chart-card__title">Weight &amp; body fat</h3>
        {hasWeight ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={weightData.rows}
                syncId="trends"
                syncMethod="value"
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                onClick={(state) => {
                  const dk = activeDayKey(state, weightData.rows)
                  if (dk) goToDay(dk)
                }}
              >
                <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
                {/* band scale (not the lines-only default of "point") so points sit on band centers,
                    matching the bar charts above — keeps the shared x labels and synced cursor aligned. */}
                <XAxis dataKey="date" scale="band" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
                <YAxis yAxisId="w" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={padDomain(unit === 'kg' ? 0.3 : 0.6)} tickFormatter={(v) => `${Math.round(Number(v) * 10) / 10}`} />
                <YAxis yAxisId="bf" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={padDomain(0.3)} />
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="w" dataKey="weight" name={`Weight (${unit})`} stroke={C.muted} strokeWidth={1} dot={{ r: 2 }} connectNulls />
                <Line yAxisId="w" dataKey="trend" name="Trend" stroke={C.accent} strokeWidth={2.5} dot={false} connectNulls />
                {weightData.hasPrediction && (
                  <Line yAxisId="w" dataKey="predWeight" name="Predicted" stroke={C.projection} strokeWidth={2} strokeDasharray="2 3" dot={false} connectNulls />
                )}
                {weightData.hasProjection && (
                  <Line yAxisId="w" dataKey="projWeight" name="Goal pace" stroke={C.goal} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                )}
                {weightData.hasBodyFat && (
                  <Line yAxisId="bf" dataKey="bodyFat" name="Body fat %" stroke={C.fat} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                )}
                {weightData.hasBodyFat && weightData.hasProjection && (
                  <Line yAxisId="bf" dataKey="projBodyFat" name="BF goal" stroke={C.fat} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
            {(weightData.hasPrediction || weightData.hasProjection) && (
              <p className="chart-card__note">
                {weightData.hasProjection && 'Goal pace = your target rate. '}
                {weightData.hasPrediction && 'Predicted = projected from what you’ve actually eaten vs burned.'}
              </p>
            )}
          </>
        ) : (
          <p className="muted chart-card__empty">Log your weight to see the trend.</p>
        )}
      </div>

      <div className="card chart-card">
        <h3 className="chart-card__title">Weight forecast</h3>
        {hasWeight && forecastData.hasProjection ? (
          <>
            {forecastData.goalDateLabel && (
              <p className="chart-card__readout">
                Goal pace{forecastData.paceLabel ? <> (<strong>{forecastData.paceLabel}</strong>)</> : null} reaches{' '}
                <strong>{forecastData.goalDisplay} {unit}</strong> by <strong>{forecastData.goalDateLabel}</strong>
                {forecastData.hasPrediction &&
                  (forecastData.predGoalLabel ? (
                    <>
                      {' '}· at your recent intake, about <strong>{forecastData.predGoalLabel}</strong>
                    </>
                  ) : (
                    <> · at your recent intake you’re not on track to reach it</>
                  ))}
              </p>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={forecastData.rows}
                syncId="trends"
                syncMethod="value"
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                onClick={(state) => {
                  const dk = activeDayKey(state, forecastData.rows)
                  if (dk) goToDay(dk)
                }}
              >
                <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
                {/* band scale (matching the charts above) so points sit on band centers — this chart
                    has its own future-extended x range, but the overlap reads consistently with them. */}
                <XAxis dataKey="date" scale="band" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={28} />
                <YAxis yAxisId="w" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={padDomain(unit === 'kg' ? 0.3 : 0.6)} tickFormatter={(v) => `${Math.round(Number(v) * 10) / 10}`} />
                {forecastData.hasBodyFat && (
                  <YAxis yAxisId="bf" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} domain={padDomain(0.3)} />
                )}
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {forecastData.goalDisplay != null && (
                  <ReferenceLine yAxisId="w" y={forecastData.goalDisplay} stroke={C.goal} strokeDasharray="4 4" label={{ value: 'goal', fill: C.muted, fontSize: 10, position: 'insideBottomRight' }} />
                )}
                <ReferenceLine yAxisId="w" x={forecastData.todayLabel} stroke={C.muted} strokeOpacity={0.6} label={{ value: 'today', fill: C.muted, fontSize: 10, position: 'insideTopLeft' }} />
                <Line yAxisId="w" dataKey="weight" name={`Weight (${unit})`} stroke={C.muted} strokeWidth={1} dot={{ r: 2 }} connectNulls />
                <Line yAxisId="w" dataKey="trend" name="Trend" stroke={C.accent} strokeWidth={2.5} dot={false} connectNulls />
                {forecastData.hasPrediction && (
                  <Line yAxisId="w" dataKey="predWeight" name="Predicted" stroke={C.projection} strokeWidth={2} strokeDasharray="2 3" dot={false} connectNulls />
                )}
                <Line yAxisId="w" dataKey="projWeight" name="Goal pace" stroke={C.goal} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                {forecastData.hasBodyFat && (
                  <Line yAxisId="bf" dataKey="bodyFat" name="Body fat %" stroke={C.fat} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                )}
                {forecastData.hasBodyFat && (
                  <Line yAxisId="bf" dataKey="projBodyFat" name="BF goal" stroke={C.fat} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="muted chart-card__empty">Set a goal weight and weekly rate in Goals to project your finish date.</p>
        )}
      </div>

      {goalProgress.hasGoal && (
        <div className="card chart-card">
          <h3 className="chart-card__title">Goal progress</h3>
          <GoalProgressTrack metrics={goalProgress.metrics} />
        </div>
      )}
    </div>
  )
}
