import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { UnitToggle } from '../components/UnitToggle'
import { GoalProgressTrack, type GoalMetric } from '../components/GoalProgress'
import { TrendGestureSurface } from '../components/TrendGestureSurface'
import { TrendScrubber } from '../components/TrendScrubber'
import { getTargets } from '../api/targets'
import { getTrendsHistory } from '../api/trends'
import { ATWATER, signedWeeklyRateKg } from '../lib/targets'
import { burnedBreakdown, balanceColor } from '../lib/energy'
import { MACRO_ORDER, NUTRITION_DISPLAY, type MacroKey } from '../lib/nutritionDisplay'
import { stepsToKcal } from '../lib/activity'
import { KCAL_PER_KG } from '../lib/tdee'
import { emaByDate, interpolateByDate, movingAverage } from '../lib/stats'
import { bandHalfWidthKg, predictWeightSeries } from '../lib/forecast'
import { fatMassKg, leanMassKg, predictBodyFatSeries } from '../lib/composition'
import { daysBetween, formatFullDay, formatShortDay, localDayKey, shiftDay } from '../lib/date'
import { kgToDisplay, useWeightUnit } from '../lib/units'
import { round1 } from '../lib/totals'
import { useChartColors } from '../lib/theme'
import {
  allTrendWindow,
  clampTrendWindow,
  integerWindowBounds,
  panTrendWindow,
  trendWindowEndingAt,
  windowSize,
  zoomTrendWindowByFactor,
  type TrendWindow,
} from '../lib/trendWindow'

const MA_WINDOW = 7
const WEIGHT_EMA_ALPHA = 0.3 // smoothing for the scale-weight trend line
const TREND_PRESETS = [7, 14, 30, 90, 180] as const
const MAX_PRESET_DAYS = TREND_PRESETS[TREND_PRESETS.length - 1]
const TIMELINE_PADDING_DAYS = 90
const CHART_LEFT_AXIS_WIDTH = 42
const CHART_RIGHT_AXIS_WIDTH = 32
const CHART_MARGIN_SINGLE_AXIS = { top: 8, right: 4, bottom: 0, left: 0 }
const CHART_MARGIN_DUAL_AXIS = { top: 8, right: 4, bottom: 0, left: 0 }

type TrendChartId = 'calories' | 'balance' | 'weight' | 'composition'
type TrendChartMode = 'card' | 'fullscreen'

const macroChartKey = (key: MacroKey) => NUTRITION_DISPLAY[key].label

function ExpandIcon() {
  return (
    <svg className="chart-card__expand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4H4v4" />
      <path d="M4 4l6 6" />
      <path d="M16 4h4v4" />
      <path d="M20 4l-6 6" />
      <path d="M8 20H4v-4" />
      <path d="M4 20l6-6" />
      <path d="M16 20h4v-4" />
      <path d="M20 20l-6-6" />
    </svg>
  )
}

function ContractIcon() {
  return (
    <svg className="trend-fullscreen__contract-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4v5H4" />
      <path d="M4 4l5 5" />
      <path d="M15 4v5h5" />
      <path d="M20 4l-5 5" />
      <path d="M9 20v-5H4" />
      <path d="M4 20l5-5" />
      <path d="M15 20v-5h5" />
      <path d="M20 20l-5-5" />
    </svg>
  )
}

interface TrendFullscreenOverlayProps {
  title: string
  rangeLabel: string
  readout?: ReactNode
  note?: ReactNode
  controls: ReactNode
  scrubber: ReactNode
  onClose: () => void
  children: ReactNode
}

function TrendFullscreenOverlay({
  title,
  rangeLabel,
  readout,
  note,
  controls,
  scrubber,
  onClose,
  children,
}: TrendFullscreenOverlayProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="trend-fullscreen" role="dialog" aria-modal="true" aria-labelledby="trend-fullscreen-title" onClick={onClose}>
      <section className="trend-fullscreen__panel" onClick={(event) => event.stopPropagation()}>
        <header className="trend-fullscreen__head">
          <span aria-hidden="true" />
          <div className="trend-fullscreen__heading">
            <h2 id="trend-fullscreen-title" className="trend-fullscreen__title">
              {title}
            </h2>
            <p className="trend-fullscreen__range">{rangeLabel}</p>
          </div>
          <button ref={closeRef} type="button" className="trend-fullscreen__close" aria-label="Exit fullscreen chart" onClick={onClose}>
            <ContractIcon />
          </button>
        </header>
        {readout && <div className="trend-fullscreen__readout">{readout}</div>}
        <div className="trend-fullscreen__chart">{children}</div>
        {note && <div className="trend-fullscreen__note">{note}</div>}
        <div className="trend-fullscreen__controls">{controls}</div>
        <div className="trend-fullscreen__scrubber">{scrubber}</div>
      </section>
    </div>
  )
}

function dayAxis(start: string, end: string): string[] {
  const span = Math.max(daysBetween(start, end), 0)
  const axis: string[] = []
  for (let i = 0; i <= span; i++) axis.push(shiftDay(start, i))
  return axis
}

function rangeLabel(axis: string[], windowRange: TrendWindow): string {
  const bounds = integerWindowBounds(windowRange, axis.length)
  const start = axis[bounds.startIndex]
  const end = axis[bounds.endIndex]
  return start && end ? `${formatShortDay(start)} - ${formatShortDay(end)}` : ''
}

function dayIndexTicks(windowRange: TrendWindow, total: number, maxTicks = 5): number[] {
  if (total <= 0) return []
  const start = Math.max(0, Math.ceil(windowRange.startIndex))
  const end = Math.min(total - 1, Math.floor(windowRange.endIndex))
  if (end < start) return [Math.max(0, Math.min(total - 1, Math.round((windowRange.startIndex + windowRange.endIndex) / 2)))]

  const span = Math.max(end - start, 0)
  const step = Math.max(1, Math.ceil(span / Math.max(maxTicks - 1, 1)))
  const ticks: number[] = []
  for (let i = start; i <= end; i += step) ticks.push(i)
  if (ticks[ticks.length - 1] !== end) ticks.push(end)
  return ticks
}

function minDay(a: string, b: string): string {
  return a < b ? a : b
}

function maxDay(a: string, b: string): string {
  return a > b ? a : b
}

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

function formatCompactAxisNumber(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1000) {
    const scaled = abs / 1000
    return `${sign}${scaled >= 10 ? Math.round(scaled) : round1(scaled)}k`
  }
  return `${sign}${Math.round(abs)}`
}

function formatOneDecimalAxis(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${round1(n)}` : ''
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
  const today = useMemo(() => localDayKey(), [])
  const [windowRange, setWindowRange] = useState<TrendWindow>({ startIndex: 0, endIndex: 29 })
  const [isGestureActive, setGestureActive] = useState(false)
  const [fullscreenChart, setFullscreenChart] = useState<TrendChartId | null>(null)
  const trendsRootRef = useRef<HTMLDivElement | null>(null)
  const historyBoundsRef = useRef<string | null>(null)
  const suppressClickUntilRef = useRef(0)
  const fullscreenChartRef = useRef<TrendChartId | null>(null)
  const expandButtonRefs = useRef<Record<TrendChartId, HTMLButtonElement | null>>({
    calories: null,
    balance: null,
    weight: null,
    composition: null,
  })
  const currentYear = new Date().getFullYear()

  const historyQuery = useQuery({
    queryKey: ['trends-history', today],
    queryFn: () => getTrendsHistory(today),
  })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })

  useEffect(() => {
    fullscreenChartRef.current = fullscreenChart
  }, [fullscreenChart])

  const closeFullscreenChart = useCallback(() => {
    const closingChart = fullscreenChartRef.current
    setFullscreenChart(null)
    if (closingChart) {
      window.requestAnimationFrame(() => expandButtonRefs.current[closingChart]?.focus())
    }
  }, [])
  const shouldSuppressChartClick = useCallback(() => Date.now() < suppressClickUntilRef.current, [suppressClickUntilRef])

  useEffect(() => {
    const el = trendsRootRef.current
    if (!el) return

    const blockBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault()
    }
    const blockGesture = (event: Event) => {
      event.preventDefault()
    }

    el.addEventListener('wheel', blockBrowserZoom, { passive: false, capture: true })
    el.addEventListener('gesturestart', blockGesture)
    el.addEventListener('gesturechange', blockGesture)
    return () => {
      el.removeEventListener('wheel', blockBrowserZoom, true)
      el.removeEventListener('gesturestart', blockGesture)
      el.removeEventListener('gesturechange', blockGesture)
    }
  }, [])

  const historyAxis = useMemo(() => {
    const hasData = Boolean(
      (historyQuery.data?.entries.length ?? 0) + (historyQuery.data?.exercise.length ?? 0) + (historyQuery.data?.metrics.length ?? 0),
    )
    const dataStart = historyQuery.data?.start_date ?? shiftDay(today, -29)
    const dataEnd = historyQuery.data?.end_date ?? today
    if (!hasData) return dayAxis(shiftDay(today, -29), today)

    const start = minDay(shiftDay(dataStart, -TIMELINE_PADDING_DAYS), shiftDay(today, 1 - MAX_PRESET_DAYS))
    let forecastEnd = shiftDay(today, TIMELINE_PADDING_DAYS)
    const loggedW = (historyQuery.data?.metrics ?? []).filter((m) => m.weight_kg != null)
    const goalKg = targetsQuery.data?.goal_weight_kg ?? null
    const magKg = Math.abs(targetsQuery.data?.weekly_rate_kg ?? 0)
    if (loggedW.length && goalKg != null && magKg > 0) {
      const smoothed = emaByDate(loggedW.map((m) => ({ date: m.date, value: m.weight_kg as number })), WEIGHT_EMA_ALPHA)
      const currentKg = smoothed[smoothed.length - 1]
      const anchorDate = loggedW[loggedW.length - 1].date
      const dir = Math.sign(goalKg - currentKg)
      if (dir !== 0) {
        const daysToGoal = Math.ceil((Math.abs(goalKg - currentKg) / magKg) * 7)
        const goalDate = shiftDay(anchorDate, daysToGoal)
        const futureDays = Math.min(Math.max(daysBetween(today, goalDate), 0), 730)
        forecastEnd = maxDay(forecastEnd, shiftDay(today, futureDays))
      }
    }
    const end = maxDay(maxDay(shiftDay(maxDay(dataEnd, today), TIMELINE_PADDING_DAYS), shiftDay(today, TIMELINE_PADDING_DAYS)), forecastEnd)
    return dayAxis(start, end)
  }, [historyQuery.data, targetsQuery.data, today])

  useEffect(() => {
    const bounds = `${historyAxis[0]}:${historyAxis[historyAxis.length - 1]}`
    const todayIndex = Math.max(0, historyAxis.indexOf(today))
    if (historyBoundsRef.current !== bounds) {
      historyBoundsRef.current = bounds
      setWindowRange(trendWindowEndingAt(historyAxis.length, todayIndex, 30))
      return
    }
    setWindowRange((prev) => clampTrendWindow(prev, historyAxis.length))
  }, [historyAxis, today])

  const visibleWindow = useMemo(() => clampTrendWindow(windowRange, historyAxis.length), [windowRange, historyAxis.length])
  const visibleBounds = useMemo(() => integerWindowBounds(visibleWindow, historyAxis.length), [visibleWindow, historyAxis.length])
  const xDomain = useMemo<[number, number]>(() => [visibleWindow.startIndex, visibleWindow.endIndex], [visibleWindow])
  const xTicks = useMemo(() => dayIndexTicks(visibleWindow, historyAxis.length), [visibleWindow, historyAxis.length])
  const axisStart = historyAxis[0] ?? today
  const formatDayIndex = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return ''
    return formatShortDay(shiftDay(axisStart, Math.round(n)))
  }
  const entriesData = useMemo(() => historyQuery.data?.entries ?? [], [historyQuery.data?.entries])
  const exerciseData = useMemo(() => historyQuery.data?.exercise ?? [], [historyQuery.data?.exercise])
  const metricsData = useMemo(() => historyQuery.data?.metrics ?? [], [historyQuery.data?.metrics])
  const chartGestureProps = {
    windowRange: visibleWindow,
    totalDays: historyAxis.length,
    onWindowChange: setWindowRange,
    onGestureActiveChange: setGestureActive,
    suppressClickUntilRef,
  }

  // Seed weight for the per-day burned (BMR) calc: the weigh-in at or before the timeline start
  // (forward-filled, since weigh-ins are sparse). When none precedes the window we fall back to the
  // LATEST weigh-in — body mass is the best available estimate for BMR, never the stale first entry.
  const baseline = useMemo(() => {
    const loggedW = metricsData.filter((m) => m.weight_kg != null)
    const onBefore = loggedW.filter((m) => m.date <= axisStart)
    const timelineStartKg = onBefore.length
      ? (onBefore[onBefore.length - 1].weight_kg as number)
      : loggedW.length
        ? (loggedW[loggedW.length - 1].weight_kg as number)
        : null
    return { timelineStartKg }
  }, [metricsData, axisStart])

  // "Where you are now": the smoothed value at the most recent weigh-in, range-independent. The
  // predicted line, the goal-pace line, and goal progress all start from this one point, so the
  // energy-balance forecast re-anchors to recent scale readings instead of the first entry ever —
  // and a single noisy reading (hydration, etc.) is damped by the time-aware EMA.
  const anchor = useMemo(() => {
    const loggedW = metricsData.filter((m) => m.weight_kg != null)
    if (!loggedW.length) return { anchorKg: null as number | null, anchorDate: null as string | null }
    const smoothed = emaByDate(loggedW.map((m) => ({ date: m.date, value: m.weight_kg as number })), WEIGHT_EMA_ALPHA)
    return { anchorKg: smoothed[smoothed.length - 1], anchorDate: loggedW[loggedW.length - 1].date }
  }, [metricsData])

  // Per-day total energy burned (BMR + baseline activity + exercise + step burn), keyed by day.
  // Weight is forward-filled across the axis (BMR needs a weight every day, but weigh-ins are sparse):
  // seed with the weight at the timeline start, then carry the latest weigh-in forward.
  // `available` is false when the profile is incomplete (no height/birth-year/sex) or there's no
  // weight on record — the burned-derived features then stay hidden.
  const burned = useMemo(() => {
    const t = targetsQuery.data
    const exByDate = new Map(exerciseData.map((d) => [d.date, d.total_calories]))
    const metricByDate = new Map(metricsData.map((m) => [m.date, m]))

    const byDay = new Map<string, number>()
    let available = false
    let carriedWeight = baseline.timelineStartKg // weight at the timeline start, forward-filled below
    for (const dk of historyAxis) {
      const m = metricByDate.get(dk)
      if (m?.weight_kg != null) carriedWeight = m.weight_kg
      const exerciseKcal = (exByDate.get(dk) ?? 0) + stepsToKcal(m?.steps, carriedWeight)
      const b = burnedBreakdown({
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
  }, [targetsQuery.data, metricsData, exerciseData, baseline, historyAxis, currentYear])

  // Calories per day, split by macro contribution (kcal), with a 7-day total-calorie average and
  // (when the profile is complete) a burned line — the gap above the bars is the day's balance.
  const calRows = useMemo(() => {
    const byDate = new Map(entriesData.map((d) => [d.date, d]))
    const totals = historyAxis.map((day) => byDate.get(day)?.total_calories ?? 0)
    const ma = movingAverage(totals, MA_WINDOW)
    return historyAxis.map((day, i) => {
      const d = byDate.get(day)
      const exp = burned.byDay.get(day)
      return {
        x: i,
        dayKey: day,
        date: formatShortDay(day),
        Protein: Math.round((d?.total_protein_g ?? 0) * ATWATER.protein),
        Fat: Math.round((d?.total_fat_g ?? 0) * ATWATER.fat),
        Carbs: Math.round((d?.total_carbs_g ?? 0) * ATWATER.carbs),
        avg: ma[i] == null ? null : Math.round(ma[i] as number),
        burned: exp == null ? null : Math.round(exp),
      }
    })
  }, [entriesData, historyAxis, burned])
  const calData = useMemo(() => calRows.slice(visibleBounds.startIndex, visibleBounds.endIndex + 1), [calRows, visibleBounds])

  // Daily balance (consumed − burned), precomputed across the whole timeline. Only days with logged
  // intake count — an unlogged day is a gap, never a phantom full-day deficit. The visible cumulative
  // line is derived from this base slice so it still resets at the current window start.
  const balanceBase = useMemo(() => {
    const byDate = new Map(entriesData.map((d) => [d.date, d]))
    const metrics = metricsData
    const lastWeightKg = [...metrics].reverse().find((m) => m.weight_kg != null)?.weight_kg ?? null
    const swr = targetsQuery.data ? signedWeeklyRateKg(targetsQuery.data, lastWeightKg) : null
    const goalDailyKcal = swr == null ? null : (swr * KCAL_PER_KG) / 7

    const rows: { x: number; dayKey: string; date: string; net: number | null }[] = []
    for (const [i, dk] of historyAxis.entries()) {
      const d = byDate.get(dk)
      const exp = burned.byDay.get(dk)
      let net: number | null = null
      if (d != null && d.entry_count > 0 && exp != null) {
        net = d.total_calories - exp
      }
      rows.push({
        x: i,
        dayKey: dk,
        date: formatShortDay(dk),
        net: net == null ? null : Math.round(net),
      })
    }
    return {
      rows,
      goalDailyKcal,
      canRender: burned.available && entriesData.some((d) => d.entry_count > 0),
    }
  }, [entriesData, metricsData, targetsQuery.data, historyAxis, burned])

  const balanceData = useMemo(() => {
    const sourceRows = balanceBase.rows.slice(visibleBounds.startIndex, visibleBounds.endIndex + 1)
    const rows: { x: number; dayKey: string; date: string; net: number | null; cumNet: number | null }[] = []
    let cum = 0
    let netKcal = 0
    let loggedDays = 0
    let started = false
    for (const r of sourceRows) {
      if (r.net != null) {
        cum += r.net
        netKcal += r.net
        loggedDays += 1
        started = true
      }
      rows.push({ ...r, cumNet: started ? Math.round(cum) : null })
    }
    return {
      rows,
      netKcal,
      loggedDays,
      goalDailyKcal: balanceBase.goalDailyKcal,
      predictedKg: round1(kgToDisplay(netKcal / KCAL_PER_KG, unit)),
      hasData: burned.available && loggedDays > 0,
      canRender: balanceBase.canRender,
    }
  }, [balanceBase, visibleBounds, burned.available, unit])

  // Weight + body-fat on the same daily axis as the calories chart. Actuals + a time-aware EMA
  // trend, a dashed goal-pace projection drawn forward from your most recent weigh-in at the goal
  // rate (clamped at the goal; body fat glides to its goal over the same timeline), and a dashed
  // "Predicted" line: anchored at that same most-recent (smoothed) weight, adding the running
  // energy balance accrued since (Σ net / 7700). Both projections share one origin point.
  const weightBase = useMemo(() => {
    const metrics = metricsData
    const byDate = new Map(metrics.map((m) => [m.date, m]))
    const logged = metrics.filter((m) => m.weight_kg != null)
    const emaVals = emaByDate(logged.map((m) => ({ date: m.date, value: m.weight_kg as number })), WEIGHT_EMA_ALPHA)
    const trendSamples = logged.map((m, i) => ({ date: m.date, value: emaVals[i] }))
    const trendVals = interpolateByDate(trendSamples, historyAxis)
    const bodyFatSamples = metrics.flatMap((m) => (m.body_fat_pct == null ? [] : [{ date: m.date, value: m.body_fat_pct }]))
    const bodyFatTrendVals = interpolateByDate(bodyFatSamples, historyAxis)

    const t = targetsQuery.data
    const currentKg = anchor.anchorKg // smoothed most-recent weight
    const anchorWeightDate = anchor.anchorDate
    const goalKg = t?.goal_weight_kg ?? null
    const magKg = Math.abs(t?.weekly_rate_kg ?? 0)
    const dir = goalKg != null && currentKg != null && magKg > 0 ? Math.sign(goalKg - currentKg) : 0
    const dailyKg = (dir * magKg) / 7
    const clampGoal = (raw: number) => (dir < 0 ? Math.max(goalKg as number, raw) : Math.min(goalKg as number, raw))
    const paceLabel = dir !== 0 ? `${dir < 0 ? 'lose' : 'gain'} ${round1(kgToDisplay(magKg, unit))} ${unit}/wk` : null
    const todayKey = today

    const lastBf = [...metrics].reverse().find((m) => m.body_fat_pct != null) ?? null
    const currentBf = lastBf?.body_fat_pct ?? null
    const goalBf = t?.goal_body_fat_pct ?? null
    // Fat-free mass at the anchor (smoothed current weight + latest body fat). The body-fat
    // forecast holds this constant, so the predicted BF line is derived from — and stays
    // consistent with — the predicted-weight line instead of gliding to its goal on its own.
    const leanKg = currentKg != null && currentBf != null ? leanMassKg(currentKg, currentBf) : null

    let goalDateKey: string | null = null
    if (dir !== 0 && currentKg != null && goalKg != null && anchorWeightDate != null) {
      const daysToGoalWeight = Math.ceil((Math.abs(goalKg - currentKg) / magKg) * 7)
      goalDateKey = shiftDay(anchorWeightDate, daysToGoalWeight)
    }

    // Predicted-weight line: from the most-recent (smoothed) weight, add the energy balance accrued
    // since; after today, extrapolate at the latest logged-day average net.
    const netRows = balanceBase.rows.filter((r) => r.net != null)
    const netByDay = new Map(netRows.map((r) => [r.dayKey, r.net as number]))
    const recentNetRows = netRows.slice(-30)
    const recentNetKcal = recentNetRows.reduce((sum, r) => sum + (r.net as number), 0)
    const avgDailyKg = recentNetRows.length > 0 ? recentNetKcal / recentNetRows.length / KCAL_PER_KG : 0
    const hasPrediction = burned.available && currentKg != null && anchorWeightDate != null
    const predSeries = hasPrediction
      ? predictWeightSeries({
          axis: historyAxis,
          anchorKg: currentKg as number,
          anchorDate: anchorWeightDate as string,
          todayKey,
          netByDay,
          avgDailyKg,
          goalKg,
          dir,
        })
      : null
    const todayIndexInWeight = Math.max(0, historyAxis.indexOf(todayKey))
    const predNowKg = predSeries ? predSeries[todayIndexInWeight] ?? null : null

    // Predicted body fat, derived from the predicted weight by holding lean mass constant
    // (every kg the forecast removes is treated as fat). Same origin as the weight forecast.
    const predBfSeries = predSeries != null && leanKg != null ? predictBodyFatSeries({ predWeightKg: predSeries, leanKg }) : null

    type WeightRow = {
      x: number
      dayKey: string
      date: string
      weight: number | null
      trend: number | null
      bodyFat: number | null
      bodyFatTrend: number | null
      projWeight: number | null
      predBodyFat: number | null
      predWeight: number | null
      band: [number, number] | null
    }
    const rows: WeightRow[] = []
    historyAxis.forEach((dk, i) => {
      const m = byDate.get(dk)
      const isFuture = dk > todayKey
      let projWeight: number | null = null
      if (dir !== 0 && currentKg != null && goalKg != null && anchorWeightDate != null && dk >= anchorWeightDate) {
        projWeight = round1(kgToDisplay(clampGoal(currentKg + dailyKg * daysBetween(anchorWeightDate, dk)), unit))
      }
      const predBf = predBfSeries?.[i] ?? null
      const predKg = predSeries?.[i] ?? null
      let band: [number, number] | null = null
      if (isFuture && predKg != null) {
        const hw = bandHalfWidthKg(daysBetween(todayKey, dk))
        band = [round1(kgToDisplay(predKg - hw, unit)), round1(kgToDisplay(predKg + hw, unit))]
      }
      rows.push({
        x: i,
        dayKey: dk,
        date: formatShortDay(dk),
        weight: m?.weight_kg == null ? null : round1(kgToDisplay(m.weight_kg, unit)),
        trend: trendVals[i] == null ? null : round1(kgToDisplay(trendVals[i] as number, unit)),
        bodyFat: m?.body_fat_pct ?? null,
        bodyFatTrend: bodyFatTrendVals[i] == null ? null : round1(bodyFatTrendVals[i] as number),
        projWeight,
        predBodyFat: predBf == null ? null : round1(predBf),
        predWeight: predKg == null ? null : round1(kgToDisplay(predKg, unit)),
        band,
      })
    })

    let predGoalKey: string | null = null
    if (hasPrediction && predNowKg != null && goalKg != null && dir !== 0 && Math.sign(avgDailyKg) === dir && avgDailyKg !== 0) {
      const predDays = Math.ceil(Math.abs(goalKg - predNowKg) / Math.abs(avgDailyKg))
      predGoalKey = shiftDay(todayKey, Math.min(predDays, 3650))
    }

    const hasBodyFat = metrics.some((m) => m.body_fat_pct != null)
    return {
      rows,
      hasProjection: dir !== 0,
      hasPrediction,
      hasBodyFat,
      hasPredBodyFat: predBfSeries != null,
      goalBodyFat: goalBf,
      leanDisplay: leanKg != null ? round1(kgToDisplay(leanKg, unit)) : null,
      paceLabel,
      anchorLabel: anchorWeightDate ? formatShortDay(anchorWeightDate) : null,
      goalDisplay: goalKg != null ? round1(kgToDisplay(goalKg, unit)) : null,
      goalDateLabel: goalDateKey ? formatFullDay(goalDateKey) : null,
      predGoalLabel: predGoalKey ? formatFullDay(predGoalKey) : null,
      todayIndex: todayIndexInWeight,
    }
  }, [metricsData, targetsQuery.data, balanceBase, anchor, burned, unit, historyAxis, today])
  const weightData = useMemo(
    () => ({ ...weightBase, rows: weightBase.rows.slice(visibleBounds.startIndex, visibleBounds.endIndex + 1) }),
    [weightBase, visibleBounds],
  )

  // Body composition: weight split into fat mass and lean (fat-free) mass, reusing the smoothed
  // weight trend and interpolated body-fat trend already computed for the weight chart. Where a
  // measured composition exists we plot it; forward of that we extend the same forecast as the
  // weight chart — lean held steady, fat absorbing the predicted weight change. Stacked, the two
  // bands sum to total weight, so you can see whether a change is fat or muscle, not just kilos.
  const compositionBase = useMemo(() => {
    // Measured composition and the forecast are separate series (own stack ids) so the forecast can
    // be drawn lighter + dashed. They share the boundary day (see the bridge below) so the two halves
    // of each band meet seamlessly.
    const rows = weightBase.rows.map((r) => {
      let fatMass: number | null = null
      let leanMass: number | null = null
      let fatForecast: number | null = null
      let leanForecast: number | null = null
      if (r.trend != null && r.bodyFatTrend != null) {
        fatMass = round1(fatMassKg(r.trend, r.bodyFatTrend))
        leanMass = round1(r.trend - fatMass)
      } else if (r.predWeight != null && weightBase.leanDisplay != null) {
        leanForecast = weightBase.leanDisplay
        fatForecast = round1(Math.max(0, r.predWeight - weightBase.leanDisplay))
      }
      return { x: r.x, dayKey: r.dayKey, date: r.date, fatMass, leanMass, fatForecast, leanForecast }
    })
    // "Now" = the most recent *measured* composition (last day with both a weight trend and a body-fat
    // value), not the end of the forecast band — which would read out at the goal/extrapolated weight.
    const lastMeasuredIdx = rows.reduce((acc, r, i) => (r.fatMass != null && r.leanMass != null ? i : acc), -1)
    const lastMeasured = lastMeasuredIdx >= 0 ? rows[lastMeasuredIdx] : null
    // Bridge: anchor the forecast band at the last measured day so it starts exactly where the solid
    // band ends (no notch). Separate stack ids keep this from double-counting at the shared day.
    if (lastMeasured) {
      lastMeasured.fatForecast = lastMeasured.fatMass
      lastMeasured.leanForecast = lastMeasured.leanMass
    }
    const leanNow = lastMeasured?.leanMass ?? null
    const fatNow = lastMeasured?.fatMass ?? null
    return {
      rows,
      todayIndex: weightBase.todayIndex,
      hasData: leanNow != null && fatNow != null,
      leanNow,
      fatNow,
      totalNow: leanNow != null && fatNow != null ? round1(leanNow + fatNow) : null,
    }
  }, [weightBase])
  const compositionData = useMemo(
    () => ({ ...compositionBase, rows: compositionBase.rows.slice(visibleBounds.startIndex, visibleBounds.endIndex + 1) }),
    [compositionBase, visibleBounds],
  )

  // Goal progress on each metric's own scale (non-date x-axis), range-independent. start = earliest
  // weigh-in on record, now = the smoothed most-recent weight, predicted = that weight plus the
  // energy balance accrued since (Σ net / 7700) — a predicted "now". All in the active weight unit.
  const goalProgress = useMemo(() => {
    const metrics = metricsData
    const t = targetsQuery.data
    const loggedW = metrics.filter((m) => m.weight_kg != null)
    const loggedBf = metrics.filter((m) => m.body_fat_pct != null)
    const disp = (kg: number) => round1(kgToDisplay(kg, unit))

    const startKg = loggedW.length ? (loggedW[0].weight_kg as number) : null
    const nowKg = anchor.anchorKg // smoothed most-recent weight
    const goalKg = t?.goal_weight_kg ?? null
    const netSinceAnchor =
      anchor.anchorDate != null
        ? balanceBase.rows.reduce((s, r) => (r.net != null && r.dayKey > (anchor.anchorDate as string) ? s + r.net : s), 0)
        : 0
    // Predicted = trend + energy balance accrued since the last weigh-in. With a weigh-in today
    // there's nothing to accrue, so it just restates the trend — drop it as redundant.
    const weighedToday = anchor.anchorDate === today
    const predKg = nowKg != null && burned.available && !weighedToday ? nowKg + netSinceAnchor / KCAL_PER_KG : null

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
        nowLabel: 'trend',
        nowHint: 'Smoothed trend (moving average) of your recent weigh-ins, not the single latest reading.',
      })
    }
    if (startBf != null && nowBf != null && goalBf != null) {
      metricsOut.push({ key: 'bodyfat', label: 'Body fat', unit: '%', start: round1(startBf), now: round1(nowBf), goal: round1(goalBf) })
    }
    return { metrics: metricsOut, hasGoal: metricsOut.length > 0 }
  }, [metricsData, targetsQuery.data, burned, balanceBase, anchor, unit, today])

  const hasEntries = entriesData.length > 0
  const hasWeight = metricsData.some((r) => r.weight_kg != null)
  const hasComposition = compositionBase.hasData
  const target = targetsQuery.data?.calorie_target

  // Tight y-axis for the calories chart: ~200 kcal of headroom above the tallest thing drawn — a
  // day's stacked macro total, the burned line, or the intake target — rounded up to 100.
  const calDomainMax = useMemo(() => {
    const peak = calData.reduce((m, r) => Math.max(m, r.Protein + r.Fat + r.Carbs, r.burned ?? 0), target ?? 0)
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

  // Forecast tooltip: fold the uncertainty band into the Predicted row as "± half-width" and drop
  // its own row, so one concept reads as one line (e.g. "Predicted : 197.2 ± 2.1").
  const renderForecastTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const orderedKeys = ['weight', 'trend', 'predWeight', 'projWeight', 'bodyFat', 'bodyFatTrend', 'predBodyFat']
    const byKey = new Map(payload.map((p) => [String(p.dataKey), p]))
    const orderedPayload = [
      ...orderedKeys.flatMap((key) => {
        const p = byKey.get(key)
        return p ? [p] : []
      }),
      ...payload.filter((p) => !orderedKeys.includes(String(p.dataKey))),
    ]
    const seenValues = new Set<string>()
    const tooltipLabels: Record<string, string> = {
      weight: `Weight (${unit})`,
      trend: `Weight trend (${unit})`,
      predWeight: 'Predicted',
      projWeight: 'Goal pace',
      bodyFat: 'Body fat %',
      bodyFatTrend: 'Body fat trend %',
      predBodyFat: 'Predicted BF %',
    }
    const tooltipLabel = (key: string, fallback: unknown): string => tooltipLabels[key] ?? String(fallback ?? key)
    const valueGroup = (key: string) => (key === 'bodyFat' || key === 'bodyFatTrend' || key === 'predBodyFat' ? 'bf' : 'weight')

    return (
      <div style={{ ...TOOLTIP.contentStyle, padding: '8px 10px', lineHeight: 1.5 }}>
        <p style={{ ...TOOLTIP.labelStyle, margin: '0 0 4px' }}>{formatDayIndex(label)}</p>
        {orderedPayload.map((p) => {
          if (p.dataKey === 'band' || p.value == null) return null
          const key = String(p.dataKey)
          const band = (p.payload as { band?: [number, number] | null } | undefined)?.band
          const pm = key === 'predWeight' && band ? ` ± ${round1((band[1] - band[0]) / 2)}` : ''
          const value = String(p.value)
          const duplicateKey = `${valueGroup(key)}:${value}`
          if (!pm && seenValues.has(duplicateKey)) return null
          seenValues.add(duplicateKey)
          return (
            <p key={String(p.dataKey)} style={{ ...TOOLTIP.itemStyle, margin: 0 }}>
              {tooltipLabel(key, p.name)} : {p.value}
              {pm}
            </p>
          )
        })}
      </div>
    )
  }

  const displayedDays = windowSize(visibleWindow)
  const displayedDaysLabel = Math.round(displayedDays)
  const todayIndex = Math.max(0, historyAxis.indexOf(today))
  const availablePresets = TREND_PRESETS.filter((days) => days < historyAxis.length)
  const panStep = Math.max(1, Math.round(displayedDays * 0.8))
  const canPanOlder = visibleWindow.startIndex > 0.01
  const canPanNewer = visibleWindow.endIndex < historyAxis.length - 1.01
  const canZoomIn = displayedDays > Math.min(7, historyAxis.length) + 0.01
  const canZoomOut = displayedDays < historyAxis.length - 0.01
  const isAllHistory = visibleWindow.startIndex <= 0.01 && visibleWindow.endIndex >= historyAxis.length - 1.01
  const displayedRange = `${rangeLabel(historyAxis, visibleWindow)} · ${displayedDaysLabel}d`
  const chartModeProps = (mode: TrendChartMode) => ({
    syncId: mode === 'fullscreen' ? 'trends-fullscreen' : 'trends',
    height: mode === 'fullscreen' ? ('100%' as const) : undefined,
  })

  const renderTrendControls = (ariaLabel: string) => (
    <div className="trend-window__controls" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="trend-window__btn"
        aria-label="Older dates"
        disabled={!canPanOlder}
        onClick={() => setWindowRange((w) => panTrendWindow(clampTrendWindow(w, historyAxis.length), historyAxis.length, -panStep))}
      >
        ‹
      </button>
      <button
        type="button"
        className="trend-window__btn"
        aria-label="Zoom out"
        disabled={!canZoomOut}
        onClick={() => setWindowRange((w) => zoomTrendWindowByFactor(clampTrendWindow(w, historyAxis.length), historyAxis.length, 1.35))}
      >
        −
      </button>
      <button
        type="button"
        className="trend-window__btn"
        aria-label="Zoom in"
        disabled={!canZoomIn}
        onClick={() => setWindowRange((w) => zoomTrendWindowByFactor(clampTrendWindow(w, historyAxis.length), historyAxis.length, 0.7))}
      >
        +
      </button>
      {availablePresets.map((days) => (
        <button
          key={days}
          type="button"
          className={`trend-window__btn trend-window__btn--text ${Math.abs(displayedDays - days) < 0.25 ? 'is-active' : ''}`}
          onClick={() => setWindowRange(trendWindowEndingAt(historyAxis.length, todayIndex, days))}
        >
          {days}d
        </button>
      ))}
      <button
        type="button"
        className={`trend-window__btn trend-window__btn--text ${isAllHistory ? 'is-active' : ''}`}
        disabled={isAllHistory}
        onClick={() => setWindowRange(allTrendWindow(historyAxis.length))}
      >
        All
      </button>
      <button
        type="button"
        className="trend-window__btn"
        aria-label="Newer dates"
        disabled={!canPanNewer}
        onClick={() => setWindowRange((w) => panTrendWindow(clampTrendWindow(w, historyAxis.length), historyAxis.length, panStep))}
      >
        ›
      </button>
    </div>
  )

  const renderChartHeader = (id: TrendChartId, title: string, canExpand: boolean) => (
    <div className="chart-card__head">
      <h3 className="chart-card__title">{title}</h3>
      {canExpand && (
        <button
          ref={(node) => {
            expandButtonRefs.current[id] = node
          }}
          type="button"
          className="chart-card__expand"
          aria-label={`Expand ${title} chart`}
          title={`Expand ${title} chart`}
          onClick={() => setFullscreenChart(id)}
        >
          <ExpandIcon />
        </button>
      )}
    </div>
  )

  const renderCaloriesChart = (mode: TrendChartMode) => {
    const { syncId, height } = chartModeProps(mode)
    return (
      <TrendGestureSurface {...chartGestureProps}>
        <ResponsiveContainer width="100%" height={height ?? 220}>
          <ComposedChart
            data={calData}
            syncId={syncId}
            syncMethod="value"
            margin={CHART_MARGIN_SINGLE_AXIS}
            onClick={(state) => {
              if (shouldSuppressChartClick()) return
              const dk = activeDayKey(state, calData)
              if (dk) goToDay(dk)
            }}
          >
            <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={formatDayIndex}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: C.grid }}
              minTickGap={24}
              allowDataOverflow
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={CHART_LEFT_AXIS_WIDTH} domain={[0, calDomainMax]} allowDataOverflow />
            {!isGestureActive && <Tooltip {...TOOLTIP} labelFormatter={formatDayIndex} />}
            {/* itemSorter={null} keeps declaration order (Protein, Fat, Carbs, Trend, Burned)
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
                isAnimationActive={false}
              />
            ))}
            <Line dataKey="avg" name="Trend" stroke={C.accent} strokeWidth={2} dot={false} connectNulls legendType="line" isAnimationActive={false} />
            {burned.available && (
              <Line
                dataKey="burned"
                name="Burned"
                stroke={C.burned}
                strokeWidth={2}
                dot={false}
                connectNulls
                legendType="line"
                isAnimationActive={false}
              />
            )}
            {target ? (
              <ReferenceLine
                y={target}
                stroke={C.muted}
                strokeDasharray="4 4"
                label={isGestureActive ? undefined : { value: 'intake target', fill: C.muted, fontSize: 10, position: 'insideTopRight' }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </TrendGestureSurface>
    )
  }

  const balanceReadout = balanceData.hasData ? (
    <p className="chart-card__readout">
      Balance <strong>{signed(balanceData.netKcal)} kcal</strong> over {balanceData.loggedDays} logged{' '}
      {balanceData.loggedDays === 1 ? 'day' : 'days'} · predicted <strong>≈ {signed1(balanceData.predictedKg)} {unit}</strong>
    </p>
  ) : (
    <p className="chart-card__readout muted">No logged days in this range.</p>
  )
  const balanceNote = (
    <p className="chart-card__note">
      {goalAware
        ? 'Bars: green = on your goal pace, red = off it. Line: running total.'
        : 'Bars: green = deficit (under), red = surplus (over). Line: running total.'}
    </p>
  )

  const renderBalanceChart = (mode: TrendChartMode) => {
    const { syncId, height } = chartModeProps(mode)
    return (
      <TrendGestureSurface {...chartGestureProps}>
        <ResponsiveContainer width="100%" height={height ?? 200}>
          <ComposedChart
            data={balanceData.rows}
            syncId={syncId}
            syncMethod="value"
            margin={CHART_MARGIN_DUAL_AXIS}
            onClick={(state) => {
              if (shouldSuppressChartClick()) return
              const dk = activeDayKey(state, balanceData.rows)
              if (dk) goToDay(dk)
            }}
          >
            <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={formatDayIndex}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: C.grid }}
              minTickGap={24}
              allowDataOverflow
            />
            <YAxis yAxisId="net" tick={AXIS_TICK} tickLine={false} axisLine={false} width={CHART_LEFT_AXIS_WIDTH} />
            <YAxis
              yAxisId="cum"
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={CHART_RIGHT_AXIS_WIDTH}
              tickMargin={2}
              tickFormatter={formatCompactAxisNumber}
            />
            {!isGestureActive && <Tooltip {...TOOLTIP} labelFormatter={formatDayIndex} />}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine yAxisId="net" y={0} stroke={C.muted} />
            <Bar yAxisId="net" dataKey="net" name="Balance (kcal)" fill={C.muted} isAnimationActive={false}>
              {balanceData.rows.map((r) => (
                <Cell key={r.dayKey} fill={barColor(r.net)} />
              ))}
            </Bar>
            <Line yAxisId="cum" dataKey="cumNet" name="Cumulative" stroke={C.projection} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </TrendGestureSurface>
    )
  }

  const weightReadout = weightData.goalDateLabel ? (
    <p className="chart-card__readout">
      Goal pace{weightData.paceLabel ? <> (<strong>{weightData.paceLabel}</strong>)</> : null} reaches{' '}
      <strong>{weightData.goalDisplay} {unit}</strong> by <strong>{weightData.goalDateLabel}</strong>
      {weightData.hasPrediction &&
        (weightData.predGoalLabel ? (
          <>
            {' '}· at your recent intake, about <strong>{weightData.predGoalLabel}</strong>
          </>
        ) : (
          <> · at your recent intake you’re not on track to reach it</>
        ))}
    </p>
  ) : null
  const weightNote =
    weightData.hasPrediction || weightData.hasProjection ? (
      <p className="chart-card__note">
        {weightData.hasProjection && 'Goal pace = your target rate. '}
        {weightData.hasPrediction &&
          `Predicted = recent intake${weightData.anchorLabel ? `, from your ${weightData.anchorLabel} weigh-in` : ''}. Shaded = forecast uncertainty.`}
        {weightData.hasPredBodyFat && ' Predicted BF % tracks that forecast, holding lean mass steady.'}
      </p>
    ) : null

  const compositionReadout = compositionData.totalNow != null ? (
    <p className="chart-card__readout">
      Lean <strong>{compositionData.leanNow}</strong> · fat <strong>{compositionData.fatNow}</strong> · total{' '}
      <strong>{compositionData.totalNow}</strong> {unit}
    </p>
  ) : null
  const compositionNote = (
    <p className="chart-card__note">
      Lean mass = weight − fat mass. Right of “today” is a forecast that holds lean steady, so projected change is all fat.
    </p>
  )

  const renderCompositionTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload as
      | { fatMass?: number | null; leanMass?: number | null; fatForecast?: number | null; leanForecast?: number | null }
      | undefined
    const fat = row?.fatMass ?? row?.fatForecast ?? null
    const lean = row?.leanMass ?? row?.leanForecast ?? null
    const total = fat != null && lean != null ? round1(fat + lean) : null
    const fatPct = fat != null && total != null && total > 0 ? round1((fat / total) * 100) : null
    const isForecast = row?.fatMass == null && row?.fatForecast != null
    return (
      <div style={{ ...TOOLTIP.contentStyle, padding: '8px 10px', lineHeight: 1.5 }}>
        <p style={{ ...TOOLTIP.labelStyle, margin: '0 0 4px' }}>
          {formatDayIndex(label)}
          {isForecast && ' · projected'}
        </p>
        {total != null && (
          <p style={{ ...TOOLTIP.itemStyle, margin: 0 }}>
            Total : {total} {unit}
          </p>
        )}
        {fat != null && (
          <p style={{ ...TOOLTIP.itemStyle, margin: 0 }}>
            Fat mass : {fat} {unit}
            {fatPct != null && ` (${fatPct}%)`}
          </p>
        )}
        {lean != null && (
          <p style={{ ...TOOLTIP.itemStyle, margin: 0 }}>
            Lean mass : {lean} {unit}
          </p>
        )}
      </div>
    )
  }

  const renderCompositionChart = (mode: TrendChartMode) => {
    const { syncId, height } = chartModeProps(mode)
    return (
      <TrendGestureSurface {...chartGestureProps}>
        <ResponsiveContainer width="100%" height={height ?? 240}>
          <ComposedChart
            data={compositionData.rows}
            syncId={syncId}
            syncMethod="value"
            margin={CHART_MARGIN_SINGLE_AXIS}
            onClick={(state) => {
              if (shouldSuppressChartClick()) return
              const dk = activeDayKey(state, compositionData.rows)
              if (dk) goToDay(dk)
            }}
          >
            <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={formatDayIndex}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: C.grid }}
              minTickGap={24}
              allowDataOverflow
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={CHART_LEFT_AXIS_WIDTH}
              domain={[0, (max: number) => Math.ceil(max + (unit === 'kg' ? 1 : 2))]}
              tickFormatter={formatOneDecimalAxis}
            />
            {!isGestureActive && <Tooltip content={renderCompositionTooltip} />}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              x={compositionData.todayIndex}
              stroke={C.muted}
              strokeOpacity={0.6}
              label={isGestureActive ? undefined : { value: 'today', fill: C.muted, fontSize: 10, position: 'insideTopLeft' }}
            />
            <Area dataKey="leanMass" name={`Lean mass (${unit})`} stackId="comp" stroke={C.protein} fill={C.protein} fillOpacity={0.5} connectNulls isAnimationActive={false} />
            <Area dataKey="fatMass" name={`Fat mass (${unit})`} stackId="comp" stroke={C.fat} fill={C.fat} fillOpacity={0.5} connectNulls isAnimationActive={false} />
            <Area
              dataKey="leanForecast"
              name="Lean mass forecast"
              stackId="forecast"
              stroke={C.protein}
              strokeDasharray="5 4"
              fill={C.protein}
              fillOpacity={0.18}
              connectNulls
              legendType="none"
              isAnimationActive={false}
            />
            <Area
              dataKey="fatForecast"
              name="Fat mass forecast"
              stackId="forecast"
              stroke={C.fat}
              strokeDasharray="5 4"
              fill={C.fat}
              fillOpacity={0.18}
              connectNulls
              legendType="none"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </TrendGestureSurface>
    )
  }

  const renderWeightChart = (mode: TrendChartMode) => {
    const { syncId, height } = chartModeProps(mode)
    return (
      <TrendGestureSurface {...chartGestureProps}>
        <ResponsiveContainer width="100%" height={height ?? 240}>
          <ComposedChart
            data={weightData.rows}
            syncId={syncId}
            syncMethod="value"
            margin={CHART_MARGIN_DUAL_AXIS}
            onClick={(state) => {
              if (shouldSuppressChartClick()) return
              const dk = activeDayKey(state, weightData.rows)
              if (dk) goToDay(dk)
            }}
          >
            <CartesianGrid stroke={C.grid} strokeOpacity={0.4} vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={formatDayIndex}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: C.grid }}
              minTickGap={24}
              allowDataOverflow
            />
            <YAxis yAxisId="w" tick={AXIS_TICK} tickLine={false} axisLine={false} width={CHART_LEFT_AXIS_WIDTH} domain={padDomain(unit === 'kg' ? 0.3 : 0.6)} tickFormatter={formatOneDecimalAxis} />
            <YAxis
              yAxisId="bf"
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={CHART_RIGHT_AXIS_WIDTH}
              domain={padDomain(0.3)}
              tickMargin={2}
              tickFormatter={formatOneDecimalAxis}
            />
            {!isGestureActive && <Tooltip content={renderForecastTooltip} />}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {weightData.hasPrediction && (
              <Area yAxisId="w" dataKey="band" name="Forecast range" stroke="none" fill={C.projection} fillOpacity={0.12} connectNulls isAnimationActive={false} legendType="none" activeDot={false} />
            )}
            {weightData.goalDisplay != null && (
              <ReferenceLine
                yAxisId="w"
                y={weightData.goalDisplay}
                stroke={C.goal}
                strokeDasharray="4 4"
                label={isGestureActive ? undefined : { value: 'goal', fill: C.muted, fontSize: 10, position: 'insideBottomRight' }}
              />
            )}
            <ReferenceLine
              yAxisId="w"
              x={weightData.todayIndex}
              stroke={C.muted}
              strokeOpacity={0.6}
              label={isGestureActive ? undefined : { value: 'today', fill: C.muted, fontSize: 10, position: 'insideTopLeft' }}
            />
            <Line yAxisId="w" dataKey="weight" name={`Weight (${unit})`} stroke={C.muted} strokeWidth={1} dot={isGestureActive ? false : { r: 2 }} connectNulls isAnimationActive={false} />
            <Line yAxisId="w" dataKey="trend" name={`Weight trend (${unit})`} stroke={C.accent} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
            {weightData.hasPrediction && (
              <Line yAxisId="w" dataKey="predWeight" name="Predicted" stroke={C.projection} strokeWidth={2} strokeDasharray="2 3" dot={false} connectNulls isAnimationActive={false} />
            )}
            {weightData.hasProjection && (
              <Line yAxisId="w" dataKey="projWeight" name="Goal pace" stroke={C.goal} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
            )}
            {weightData.hasBodyFat && (
              <Line yAxisId="bf" dataKey="bodyFatTrend" name="Body fat trend %" stroke={C.fat} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            )}
            {weightData.hasBodyFat && (
              <Line
                yAxisId="bf"
                dataKey="bodyFat"
                name="Body fat measurement %"
                stroke="transparent"
                strokeWidth={0}
                dot={isGestureActive ? false : { r: 2, fill: C.fat, stroke: C.fat }}
                tooltipType="none"
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {weightData.hasBodyFat && weightData.goalBodyFat != null && (
              <ReferenceLine
                yAxisId="bf"
                y={weightData.goalBodyFat}
                stroke={C.fat}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={isGestureActive ? undefined : { value: 'BF goal', fill: C.muted, fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            {weightData.hasBodyFat && weightData.hasPredBodyFat && (
              <Line yAxisId="bf" dataKey="predBodyFat" name="Predicted BF %" stroke={C.fat} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </TrendGestureSurface>
    )
  }

  const fullscreenContent =
    fullscreenChart === 'calories' && hasEntries
      ? { title: 'Calories by macro', readout: null, note: null, chart: renderCaloriesChart('fullscreen') }
      : fullscreenChart === 'balance' && balanceData.canRender
        ? { title: 'Energy balance', readout: balanceReadout, note: balanceNote, chart: renderBalanceChart('fullscreen') }
        : fullscreenChart === 'weight' && hasWeight
          ? { title: 'Weight & forecast', readout: weightReadout, note: weightNote, chart: renderWeightChart('fullscreen') }
          : fullscreenChart === 'composition' && hasComposition
            ? { title: 'Body composition', readout: compositionReadout, note: compositionNote, chart: renderCompositionChart('fullscreen') }
            : null
  const fullscreenOpen = fullscreenContent != null

  return (
    <div ref={trendsRootRef} className="page trends">
      <div className="trends__bar">
        <div className="trend-window">
          <div className="trend-window__label">{displayedRange}</div>
          {renderTrendControls('Timeline controls')}
        </div>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>

      <TrendScrubber axis={historyAxis} windowRange={visibleWindow} onWindowChange={setWindowRange} />

      {fullscreenContent && (
        <TrendFullscreenOverlay
          title={fullscreenContent.title}
          rangeLabel={displayedRange}
          readout={fullscreenContent.readout}
          note={fullscreenContent.note}
          controls={renderTrendControls('Fullscreen timeline controls')}
          scrubber={<TrendScrubber axis={historyAxis} windowRange={visibleWindow} onWindowChange={setWindowRange} />}
          onClose={closeFullscreenChart}
        >
          {fullscreenContent.chart}
        </TrendFullscreenOverlay>
      )}

      <div className="card chart-card">
        {renderChartHeader('calories', 'Calories by macro', hasEntries)}
        {hasEntries ? (
          fullscreenOpen ? null : renderCaloriesChart('card')
        ) : (
          <p className="muted chart-card__empty">No entries in this range yet.</p>
        )}
      </div>

      <div className="card chart-card">
        {renderChartHeader('balance', 'Energy balance', balanceData.canRender)}
        {balanceData.canRender ? (
          <>
            {balanceReadout}
            {!fullscreenOpen && renderBalanceChart('card')}
            {balanceNote}
          </>
        ) : (
          <p className="muted chart-card__empty">
            Add your profile (height, age, sex) in Goals and log food to see your energy balance.
          </p>
        )}
      </div>

      <div className="card chart-card">
        {renderChartHeader('weight', 'Weight & forecast', hasWeight)}
        {hasWeight ? (
          <>
            {weightReadout}
            {!fullscreenOpen && renderWeightChart('card')}
            {weightNote}
          </>
        ) : (
          <p className="muted chart-card__empty">Log your weight to see the trend.</p>
        )}
      </div>

      <div className="card chart-card">
        {renderChartHeader('composition', 'Body composition', hasComposition)}
        {hasComposition ? (
          <>
            {compositionReadout}
            {!fullscreenOpen && renderCompositionChart('card')}
            {compositionNote}
          </>
        ) : (
          <p className="muted chart-card__empty">Log your weight and body fat % on the same day to see lean vs. fat mass.</p>
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
