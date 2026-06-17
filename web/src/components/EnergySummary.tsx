import type { MacroTotals } from '../lib/totals'
import { round, formatFoodWeight, formatDrinkVolume } from '../lib/totals'
import { fiberGramTarget, macroGramTargets, signedWeeklyRateKg } from '../lib/targets'
import {
  STAYING_POWER_LABELS,
  STAYING_POWER_TIERS,
  type DayStayingPower,
  type StayingPowerTier,
} from '../lib/stayingPower'
import { cssVar, MACRO_ORDER, NUTRIENT_ORDER, NUTRITION_DISPLAY, type MacroKey } from '../lib/nutritionDisplay'
import { usePersistentToggle } from '../lib/prefs'
import { useWeightUnit, kgToDisplay } from '../lib/units'
import {
  macroEnergy,
  topContributors,
  balanceProjection,
  goalGapKcal,
  balanceColor,
  BALANCE_RED_KCAL,
  type ContribKey,
  type Contributor,
  type MacroEnergy,
  type ExpenditureBreakdown,
  type BalanceProjection,
} from '../lib/energy'
import { KCAL_PER_KG } from '../lib/tdee'
import { Popover } from './Popover'
import type { Entry, Targets } from '../types'

const macroEnergyValue = (me: MacroEnergy, key: MacroKey) => me[key]

function signedKcal(n: number): string {
  const r = round(n)
  if (r === 0) return '0'
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}`
}

interface Props {
  totals: MacroTotals
  targets: Targets
  stayingPower: DayStayingPower
  expenditure: number // kcal burned this day (steps + exercise); 0 if none
  expenditureBreakdown: ExpenditureBreakdown | null // null when the profile is incomplete
  entries: Entry[]
  isToday: boolean
  currentWeightKg: number | null // latest weigh-in; gives the goal rate its lose/gain direction
}

/** Cronometer-inspired daily energy summary: Consumed / Expenditure / Deficit rings with macro and
 *  per-food breakdown popovers. Falls back to the simpler Consumed/Remaining view when the profile
 *  is incomplete (no BMR → no expenditure breakdown). */
export function EnergySummary({ totals, targets, stayingPower, expenditure, expenditureBreakdown: eb, entries, isToday, currentWeightKg }: Props) {
  if (!eb) {
    return <LegacyEnergySummary totals={totals} targets={targets} stayingPower={stayingPower} expenditure={expenditure} />
  }

  const grams = macroGramTargets(targets)
  const fiberTarget = fiberGramTarget(targets)
  const target = targets.calorie_target
  const consumed = totals.calories
  const me = macroEnergy(totals)
  const balanceKcal = consumed - eb.total
  const bp = balanceProjection({
    expenditureTotal: eb.total,
    consumed,
    calorieTarget: target,
    isToday,
    goalWeeklyRateKg: signedWeeklyRateKg(targets, currentWeightKg),
  })

  const consumedSegments = MACRO_ORDER.map((key) => ({
    value: macroEnergyValue(me, key),
    color: cssVar(NUTRITION_DISPLAY[key].colorVar),
  }))
  const expSegments = [
    { value: eb.bmr, color: 'var(--exp-bmr)' },
    { value: eb.baseline, color: 'var(--exp-baseline)' },
    { value: eb.exercise, color: 'var(--exp-exercise)' },
  ]

  // Accounting view: energy in (+) and out (−) sum to the balance (+1853 and −3308 → −1455).
  const consumedValue = signedKcal(consumed)
  const expenditureValue = signedKcal(-eb.total)
  // "Balance" dial: top is the plan balance; left/right show a steeper deficit or higher intake.
  const balanceLabel = `Balance${isToday ? ' (so far)' : ''}`
  const balanceValue = signedKcal(balanceKcal)
  const usesWeightGoal = bp.goalWeeklyKg != null
  const planBalanceKcal = usesWeightGoal ? (bp.goalWeeklyKg as number) * KCAL_PER_KG / 7 : target - eb.total
  const balanceGapKcal = balanceKcal - planBalanceKcal
  const balanceTone = balanceColor(balanceGapKcal) ?? undefined
  const balanceSub = balanceGapLabel(balanceGapKcal)

  return (
    <div className="card energy-summary">
      <div className="energy-summary__rings">
        <Popover label="Calories consumed breakdown" placement="bottom" content={<ConsumedDetail me={me} />}>
          <SegmentedRing label="Consumed" value={consumedValue} unit="kcal" segments={consumedSegments} />
        </Popover>
        <Popover label="Energy expenditure breakdown" placement="bottom" content={<ExpenditureDetail eb={eb} />}>
          <SegmentedRing label="Expenditure" value={expenditureValue} unit="kcal" segments={expSegments} />
        </Popover>
        <Popover
          label="Energy balance details"
          placement="bottom"
          content={
            <DeficitDetail
              expenditure={eb.total}
              consumed={consumed}
              balanceKcal={balanceKcal}
              balanceGapKcal={balanceGapKcal}
              usesWeightGoal={usesWeightGoal}
              isToday={isToday}
              guidance={balanceGuidance(bp.kcalPerDay)}
            />
          }
        >
          <BalanceDial
            label={balanceLabel}
            value={balanceValue}
            unit="kcal"
            sub={balanceSub}
            gapKcal={balanceGapKcal}
            color={balanceTone}
          />
        </Popover>
      </div>

      <BalanceLine bp={bp} target={target} />

      <div className="energy-summary__bars">
        <ProgressBar
          label="Energy"
          value={consumed}
          target={target}
          unit="kcal"
          colorVar="--energy"
          contributors={topContributors(entries, 'calories')}
          contribTitle="Energy (kcal)"
        />
        {NUTRIENT_ORDER.map((key) => {
          const display = NUTRITION_DISPLAY[key]
          const field = display.field as ContribKey
          const targetValue = key === 'fiber' ? fiberTarget : grams[display.field as keyof typeof grams]
          return (
            <MacroProgress
              key={key}
              label={display.label}
              field={field}
              value={totals[field]}
              target={targetValue}
              colorVar={display.colorVar}
              entries={entries}
            />
          )
        })}
      </div>

      <StayingPowerMeter day={stayingPower} />
    </div>
  )
}

/** The pre-redesign view, shown when there's no expenditure breakdown (incomplete profile). */
function LegacyEnergySummary({
  totals,
  targets,
  stayingPower,
  expenditure,
}: {
  totals: MacroTotals
  targets: Targets
  stayingPower: DayStayingPower
  expenditure: number
}) {
  const [netMode, setNetMode] = usePersistentToggle('net-mode', true)
  const grams = macroGramTargets(targets)
  const fiberTarget = fiberGramTarget(targets)
  const target = targets.calorie_target
  const consumed = totals.calories
  const useNet = expenditure > 0 && netMode
  const remaining = useNet ? target - consumed + expenditure : target - consumed
  const consumedFrac = target > 0 ? consumed / target : 0

  return (
    <div className="card energy-summary">
      {expenditure > 0 && (
        <div className="energy-summary__net">
          <span className="muted">🔥 {round(expenditure)} kcal burned</span>
          <div className="seg" role="group" aria-label="Calorie mode">
            <button className={`seg__btn ${!netMode ? 'is-active' : ''}`} onClick={() => setNetMode(false)}>
              Gross
            </button>
            <button className={`seg__btn ${netMode ? 'is-active' : ''}`} onClick={() => setNetMode(true)}>
              Net
            </button>
          </div>
        </div>
      )}

      <div className="energy-summary__rings">
        <Ring
          label="Consumed"
          value={round(consumed)}
          unit="kcal"
          sub={`${round(consumedFrac * 100)}%`}
          fraction={consumedFrac}
          over={consumedFrac > 1}
        />
        <Ring
          label="Remaining"
          value={round(remaining)}
          unit="kcal"
          fraction={target > 0 ? remaining / target : 0}
          over={remaining < 0}
        />
      </div>

      <p className="muted energy-summary__hint">Add your height, age &amp; sex in Goals to see expenditure &amp; deficit.</p>

      <div className="energy-summary__bars">
        {NUTRIENT_ORDER.map((key) => {
          const display = NUTRITION_DISPLAY[key]
          const field = display.field as keyof MacroTotals
          return (
            <ProgressBar
              key={key}
              label={display.label}
              value={totals[field]}
              target={key === 'fiber' ? fiberTarget : grams[display.field as keyof typeof grams]}
              unit="g"
              colorVar={display.colorVar}
            />
          )
        })}
      </div>

      <StayingPowerMeter day={stayingPower} />
    </div>
  )
}

function ConsumedDetail({ me }: { me: MacroEnergy }) {
  const rows = MACRO_ORDER.map((key) => ({
    label: NUTRITION_DISPLAY[key].label,
    kcal: macroEnergyValue(me, key),
    color: cssVar(NUTRITION_DISPLAY[key].colorVar),
  }))
  const gap = me.logged > 0 ? Math.abs(me.total - me.logged) / me.logged : 0
  return (
    <div>
      <div className="popover__title">Calories consumed (kcal)</div>
      <div className="contrib-table">
        {rows.map((r) => (
          <div className="contrib-table__row" key={r.label}>
            <span className="contrib-table__name">
              <span className="contrib-table__dot" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="contrib-table__val">{round(r.kcal)}</span>
            <span className="contrib-table__pct">{me.total > 0 ? round((r.kcal / me.total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
      {gap > 0.03 && (
        <p className="popover__note">
          Macro calories ({round(me.total)}) differ from the logged total ({round(me.logged)}) — fiber, rounding, or
          unlogged macros.
        </p>
      )}
    </div>
  )
}

function ExpenditureDetail({ eb }: { eb: ExpenditureBreakdown }) {
  const rows = [
    { label: 'Basal metabolic rate (BMR)', kcal: eb.bmr, color: 'var(--exp-bmr)' },
    { label: 'Baseline activity', kcal: eb.baseline, color: 'var(--exp-baseline)' },
    { label: 'Exercise', kcal: eb.exercise, color: 'var(--exp-exercise)' },
  ]
  return (
    <div>
      <div className="popover__title">Energy expenditure</div>
      <div className="contrib-table">
        {rows.map((r) => (
          <div className="contrib-table__row" key={r.label}>
            <span className="contrib-table__name">
              <span className="contrib-table__dot" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="contrib-table__val">{round(r.kcal)}</span>
            <span className="contrib-table__pct">{eb.total > 0 ? round((r.kcal / eb.total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
      {eb.exercise > 0 && <p className="popover__note">Exercise includes step-derived burn.</p>}
    </div>
  )
}

function DeficitDetail({
  expenditure,
  consumed,
  balanceKcal,
  balanceGapKcal,
  usesWeightGoal,
  isToday,
  guidance,
}: {
  expenditure: number
  consumed: number
  balanceKcal: number
  balanceGapKcal: number
  usesWeightGoal: boolean
  isToday: boolean
  guidance?: string | null
}) {
  const word = balanceKcal > 0 ? 'Surplus' : balanceKcal < 0 ? 'Deficit' : 'Balance'
  const offPlan = Math.abs(balanceGapKcal) > BALANCE_HINT_KCAL
  const planSource = usesWeightGoal ? 'weight goal' : 'calorie target'
  return (
    <div>
      <div className="popover__title">
        Energy balance
        {isToday ? ' (so far today)' : ''}
      </div>
      <div className="contrib-table contrib-table--calc">
        <div className="contrib-table__row">
          <span className="contrib-table__name">Consumed</span>
          <span className="contrib-table__val">{signedKcal(consumed)} kcal</span>
        </div>
        <div className="contrib-table__row">
          <span className="contrib-table__name">Expenditure</span>
          <span className="contrib-table__val">{signedKcal(-expenditure)} kcal</span>
        </div>
        <div className="contrib-table__row contrib-table__row--total">
          <span className="contrib-table__name">{word}</span>
          <span className="contrib-table__val">{signedKcal(balanceKcal)} kcal</span>
        </div>
      </div>
      <p className="popover__note">
        The top tick is the plan balance from your {planSource}; left is a steeper deficit, right is higher intake or
        surplus.
      </p>
      {offPlan && <p className="popover__note popover__note--warn">{balanceGapSentence(balanceGapKcal)}.</p>}
      {guidance && <p className="popover__note popover__note--warn">{guidance}</p>}
    </div>
  )
}

function ContribTable({ title, rows, unit }: { title: string; rows: Contributor[]; unit: string }) {
  return (
    <div>
      <div className="popover__title">{title}</div>
      <div className="contrib-table">
        {rows.map((r, i) => (
          <div className="contrib-table__row" key={i}>
            <span className="contrib-table__name">{r.name}</span>
            <span className="contrib-table__val">
              {round(r.value)} {unit}
            </span>
            <span className="contrib-table__pct">{round(r.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// |daily gap from goal| (kcal) beyond which we surface the target-vs-goal mismatch.
const BALANCE_HINT_KCAL = 150

// Sustained daily balance (kcal) beyond which we surface wellness guidance, per direction.
const LARGE_DEFICIT_KCAL = 1000
const LARGE_SURPLUS_KCAL = 700

function balanceGapLabel(gapKcal: number): string {
  const gap = round(Math.abs(gapKcal))
  if (gap <= BALANCE_HINT_KCAL) return 'on plan'
  return `${gap} ${gapKcal < 0 ? 'below' : 'above'} plan`
}

function balanceGapSentence(gapKcal: number): string {
  const gap = round(Math.abs(gapKcal))
  return `${gap} kcal ${gapKcal < 0 ? 'below plan: a steeper deficit' : 'above plan: higher intake or surplus'}`
}

/** General, hedged guidance when a *sustained* balance is large in either direction; null otherwise.
 *  Keyed off the projected/realized balance (not the inflated "so far" number). */
function balanceGuidance(kcalPerDay: number): string | null {
  if (kcalPerDay <= -LARGE_DEFICIT_KCAL) {
    return 'Sustained deficits this large can bring low energy, constant hunger, irritability, poor sleep, and loss of muscle along with fat. A smaller deficit is usually easier to sustain.'
  }
  if (kcalPerDay >= LARGE_SURPLUS_KCAL) {
    return 'Surpluses beyond what muscle growth needs are stored as fat (~3,500 kcal ≈ 1 lb) and can spike blood sugar. Trimming the surplus limits fat gain.'
  }
  return null
}

function BalanceLine({ bp, target }: { bp: BalanceProjection; target: number }) {
  const [unit] = useWeightUnit()
  const losing = bp.kcalPerDay < 0
  const verb = losing ? 'lose' : 'gain'

  if (bp.basis === 'actual') {
    const dayDisplay = kgToDisplay(Math.abs(bp.weeklyKg) / 7, unit)
    return (
      <p className="energy-balance">
        {losing ? 'Deficit' : 'Surplus'} {round(Math.abs(bp.kcalPerDay))} kcal · ≈ {verb} {dayDisplay.toFixed(2)} {unit}{' '}
        that day
      </p>
    )
  }

  const rate = kgToDisplay(Math.abs(bp.weeklyKg), unit)
  const gap = goalGapKcal(bp)
  const recommended = gap != null ? round(target - gap) : null
  const goalRate = kgToDisplay(Math.abs(bp.goalWeeklyKg ?? 0), unit).toFixed(1)
  const goalVerb = bp.goalWeeklyKg == null || bp.goalWeeklyKg === 0 ? 'maintain' : bp.goalWeeklyKg < 0 ? 'lose' : 'gain'
  // On-goal (within tolerance) → green; any larger gap, in either direction → red. Matches the ring.
  const offGoal = gap != null && Math.abs(gap) > BALANCE_HINT_KCAL
  const stateClass = gap == null ? '' : offGoal ? ' is-off' : ' is-good'
  const showMismatch = offGoal && recommended != null
  return (
    <div className="energy-balance-block">
      <p className={`energy-balance${stateClass}`}>
        On plan (eat {round(target)} kcal): {round(Math.abs(bp.kcalPerDay))} kcal/day {losing ? 'deficit' : 'surplus'} ·{' '}
        <span className="energy-balance__rate">
          ≈ {verb} {rate.toFixed(1)} {unit}/wk
        </span>
        {bp.goalWeeklyKg != null && bp.goalWeeklyKg !== 0 && (
          <>
            {' '}
            · goal: {goalVerb} {goalRate} {unit}/wk
          </>
        )}
      </p>
      {showMismatch && (
        <p className="energy-balance__note">
          {bp.goalWeeklyKg === 0
            ? `That ${round(target)} kcal target won't hold your weight — aim to consume ~${recommended} kcal/day total.`
            : `That ${round(target)} kcal target trends to ${verb} ${rate.toFixed(1)} ${unit}/wk, not your goal to ${goalVerb} ${goalRate} ${unit}/wk — aim to consume ~${recommended} kcal/day total.`}
        </p>
      )}
    </div>
  )
}

function mealWord(count: number): string {
  return count === 1 ? 'meal' : 'meals'
}

function tierClass(tier: StayingPowerTier): string {
  return `staying-seg--${tier}`
}

/** Meal-count overview for portion-based staying power across the day. */
function StayingPowerMeter({ day }: { day: DayStayingPower }) {
  if (day.totalMeals <= 0) return null
  const pct = (v: number) => (v / day.totalMeals) * 100
  const segments = STAYING_POWER_TIERS.map((tier) => ({
    key: tier,
    label: STAYING_POWER_LABELS[tier],
    value: day.byTier[tier],
  })).filter((s) => s.value > 0)

  return (
    <div className="staying-meter">
      <div className="staying-meter__head">
        <span className="macro-bar__label">Staying power</span>
        <span className="macro-bar__nums">
          {segments.map((s) => `${s.label} ${s.value}`).join(' · ')}
        </span>
      </div>
      <div className="staying-meter__bar">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`staying-meter__seg ${tierClass(s.key)}`}
            style={{ width: `${pct(s.value)}%` }}
            title={`${s.label}: ${s.value} ${mealWord(s.value)}`}
          />
        ))}
      </div>
      <div className="staying-meter__legend">
        {segments.map((s) => (
          <span key={s.key} className="staying-meter__legend-item">
            <span className={`staying-meter__dot ${tierClass(s.key)}`} />
            {s.label} {s.value} {mealWord(s.value)}
          </span>
        ))}
      </div>
      <p className="staying-meter__volume">
        {[
          day.foodWeightG > 0 ? `${formatFoodWeight(day.foodWeightG)} food` : null,
          `${round(day.protein_g)}g protein`,
          day.fiber_g > 0 ? `${round(day.fiber_g)}g fiber` : null,
          day.beverageWeightG > 0 ? `${formatDrinkVolume(day.beverageWeightG)} drinks` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

const RING_SIZE = 120
const RING_STROKE = 12
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R
const RING_CENTER = RING_SIZE / 2
const BALANCE_DIAL_SWEEP_DEG = 90

interface Segment {
  value: number
  color: string
}

/** A donut whose arc is split into consecutive macro/expenditure segments. */
function SegmentedRing({
  label,
  value,
  unit,
  sub,
  segments,
}: {
  label: string
  value: number | string
  unit: string
  sub?: string
  segments: Segment[]
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  let offset = 0
  return (
    <div className="energy-ring">
      <div className="energy-ring__chart">
        <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_R} fill="none" stroke="var(--border)" strokeWidth={RING_STROKE} />
          {total > 0 &&
            segments.map((seg, i) => {
              const dash = (Math.max(0, seg.value) / total) * RING_C
              const node = (
                <circle
                  key={i}
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={RING_STROKE}
                  strokeDasharray={`${dash} ${RING_C - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
                />
              )
              offset += dash
              return node
            })}
        </svg>
        <div className="energy-ring__center">
          <span className="energy-ring__value">{value}</span>
          <span className="energy-ring__unit">{unit}</span>
          {sub && <span className="energy-ring__sub">{sub}</span>}
        </div>
      </div>
      <span className="energy-ring__label">{label}</span>
    </div>
  )
}

function polarPoint(angleDeg: number, radius = RING_R): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  return {
    x: RING_CENTER + radius * Math.cos(a),
    y: RING_CENTER + radius * Math.sin(a),
  }
}

function BalanceDial({
  label,
  value,
  unit,
  sub,
  gapKcal,
  color,
}: {
  label: string
  value: number | string
  unit: string
  sub?: string
  gapKcal: number
  color?: string
}) {
  const t = Math.min(Math.max(gapKcal / BALANCE_RED_KCAL, -1), 1)
  const sweep = t * BALANCE_DIAL_SWEEP_DEG
  const arc = (Math.abs(sweep) / 360) * RING_C
  const arcStart = sweep < 0 ? -90 + sweep : -90
  const marker = polarPoint(-90 + sweep)
  const targetInner = polarPoint(-90, RING_R - RING_STROKE / 2)
  const targetOuter = polarPoint(-90, RING_R + RING_STROKE / 2)
  const dialColor = color ?? 'var(--accent)'

  return (
    <div className="energy-ring energy-dial">
      <div className="energy-ring__chart">
        <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_R} fill="none" stroke="var(--border)" strokeWidth={RING_STROKE} />
          {arc > 0.5 && (
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_R}
              fill="none"
              stroke={dialColor}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${RING_C - arc}`}
              transform={`rotate(${arcStart} ${RING_CENTER} ${RING_CENTER})`}
            />
          )}
          <line
            className="energy-dial__target"
            x1={targetInner.x}
            y1={targetInner.y}
            x2={targetOuter.x}
            y2={targetOuter.y}
          />
          <circle className="energy-dial__marker" cx={marker.x} cy={marker.y} r="5.5" fill={dialColor} />
        </svg>
        <div className="energy-ring__center">
          <span className="energy-ring__value">{value}</span>
          <span className="energy-ring__unit">{unit}</span>
          {sub && <span className="energy-ring__sub">{sub}</span>}
        </div>
      </div>
      <span className="energy-ring__label">{label}</span>
    </div>
  )
}

function Ring({
  label,
  value,
  unit,
  sub,
  fraction,
  over,
  color,
}: {
  label: string
  value: number | string
  unit: string
  sub?: string
  fraction: number // 0..1+ ; clamped to the ring for the arc
  over?: boolean
  color?: string // explicit arc color; falls back to the over/under accent/danger
}) {
  const clamped = Math.min(Math.max(fraction, 0), 1)
  const dashoffset = RING_C * (1 - clamped)
  return (
    <div className="energy-ring">
      <div className="energy-ring__chart">
        <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_R} fill="none" stroke="var(--border)" strokeWidth={RING_STROKE} />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_R}
            fill="none"
            stroke={color ?? (over ? 'var(--danger)' : 'var(--accent)')}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          />
        </svg>
        <div className="energy-ring__center">
          <span className="energy-ring__value">{value}</span>
          <span className="energy-ring__unit">{unit}</span>
          {sub && <span className="energy-ring__sub">{sub}</span>}
        </div>
      </div>
      <span className="energy-ring__label">{label}</span>
    </div>
  )
}

/** A macro/energy progress bar whose label opens a per-food contributor popover. */
function MacroProgress({
  label,
  field,
  value,
  target,
  colorVar,
  entries,
}: {
  label: string
  field: ContribKey
  value: number
  target: number
  colorVar: string
  entries: Entry[]
}) {
  return (
    <ProgressBar
      label={label}
      value={value}
      target={target}
      unit="g"
      colorVar={colorVar}
      contributors={topContributors(entries, field)}
      contribTitle={`${label} (g)`}
    />
  )
}

function ProgressBar({
  label,
  value,
  target,
  unit,
  colorVar,
  contributors,
  contribTitle,
}: {
  label: string
  value: number
  target: number
  unit: string
  colorVar: string
  contributors?: Contributor[]
  contribTitle?: string
}) {
  const frac = target > 0 ? value / target : 0
  const width = Math.min(Math.max(frac, 0), 1) * 100
  const over = frac > 1
  const bar = (
    <div className="macro-bar">
      <div className="macro-bar__head">
        <span className="macro-bar__label">{label}</span>
        <span className="macro-bar__nums">
          {round(value)} / {round(target)} {unit} · {round(frac * 100)}%
        </span>
      </div>
      <div className="macro-bar__track">
        <div
          className={`macro-bar__fill${over ? ' is-over' : ''}`}
          // Inline color only when on-target; the .is-over class (CSS) wins when over.
          style={{ width: `${width}%`, ...(over ? {} : { background: `var(${colorVar})` }) }}
        />
      </div>
    </div>
  )
  // The whole bar is the popover trigger when there are contributions to show.
  if (contributors && contributors.length > 0) {
    return (
      <Popover label={`${label} breakdown`} content={<ContribTable title={contribTitle ?? label} rows={contributors} unit={unit} />}>
        {bar}
      </Popover>
    )
  }
  return bar
}
