import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EnergySummary } from '../components/EnergySummary'
import { MealSection } from '../components/MealSection'
import { MetricCard } from '../components/MetricCard'
import { MetricEditor } from '../components/MetricEditor'
import { Modal } from '../components/Modal'
import { DayPicker } from '../components/DayPicker'
import { ExerciseSection } from '../components/ExerciseSection'
import { AddExercise } from '../components/AddExercise'
import { CapturePage } from './CapturePage'
import { deleteEntry, getEntries, patchEntry } from '../api/entries'
import { getExercise } from '../api/exercise'
import { getLatestMetric, getMetrics } from '../api/metrics'
import { getTargets } from '../api/targets'
import { formatDayLabel, localDayKey, shiftDay } from '../lib/date'
import { sumTotals } from '../lib/totals'
import { dayStayingPower, mealStayingPower } from '../lib/stayingPower'
import { stepsToKcal } from '../lib/activity'
import { burnedBreakdown } from '../lib/energy'
import { groupByMeal } from '../lib/meals'
import { DEFAULT_TARGETS } from '../lib/targets'
import { usePersistentToggle } from '../lib/prefs'
import type { EntryCreate, Meal } from '../types'

// How far back to look for the previous weigh-in that the day's weight delta is measured against.
const WEIGHT_DELTA_LOOKBACK_DAYS = 365

interface Props {
  day: string
  setDay: (day: string) => void
}

export function LogPage({ day, setDay }: Props) {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<'metric' | 'exercise' | null>(null)
  const [foodMeal, setFoodMeal] = useState<Meal | 'auto' | null>(null) // food capture target; null = closed, 'auto' = meal by time
  const [picker, setPicker] = useState(false)
  const [simple, setSimple] = usePersistentToggle('simple-view', false) // false = Detailed (default)

  const entriesQuery = useQuery({ queryKey: ['entries', day], queryFn: () => getEntries(day) })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })
  const metricQuery = useQuery({ queryKey: ['metrics', day, day], queryFn: () => getMetrics(day, day) })
  const weightHistoryFrom = shiftDay(day, -WEIGHT_DELTA_LOOKBACK_DAYS)
  const weightHistoryQuery = useQuery({
    queryKey: ['metrics', weightHistoryFrom, day],
    queryFn: () => getMetrics(weightHistoryFrom, day),
  })
  const latestWeightQuery = useQuery({ queryKey: ['metrics', 'latest'], queryFn: getLatestMetric })
  const exerciseQuery = useQuery({ queryKey: ['exercise', day], queryFn: () => getExercise(day) })

  // An edit can move an entry to another day, so invalidate all day lists + the trends range.
  const invalidateEntries = () => {
    queryClient.invalidateQueries({ queryKey: ['entries'] })
    queryClient.invalidateQueries({ queryKey: ['entries-range'] })
    queryClient.invalidateQueries({ queryKey: ['trends-history'] })
  }
  const remove = useMutation({ mutationFn: deleteEntry, onSuccess: invalidateEntries })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<EntryCreate> }) => patchEntry(id, patch),
    onSuccess: invalidateEntries,
  })

  const entries = entriesQuery.data ?? []
  const totals = sumTotals(entries)
  const groups = groupByMeal(entries)
  const mealPowers = groups.flatMap((g) => {
    const power = mealStayingPower(g.entries)
    return power ? [power] : []
  })
  const stayingPower = dayStayingPower(mealPowers)
  const isToday = day === localDayKey()
  const metric = metricQuery.data?.[0]

  // Most recent weigh-in strictly before this day, for the "since last time" weight delta. Metrics
  // come back ascending by date, so the last match is the closest prior weigh-in.
  const priorWeighIn =
    [...(weightHistoryQuery.data ?? [])].reverse().find((m) => m.weight_kg != null && m.date < day) ?? null

  // Net calories burned for the day: logged exercise + step-derived burn. Steps use the
  // most recent logged weight (you needn't weigh in daily), not just this day's.
  const exerciseKcal = (exerciseQuery.data ?? []).reduce((sum, e) => sum + e.calories, 0)
  const burned = exerciseKcal + stepsToKcal(metric?.steps, latestWeightQuery.data?.weight_kg)

  // Full burned split (BMR + baseline + exercise) for the 3-ring view; null if the profile is
  // incomplete, in which case EnergySummary falls back to the Consumed/Remaining view.
  const targets = targetsQuery.data ?? DEFAULT_TARGETS
  const burnedDetail = burnedBreakdown({
    weightKg: latestWeightQuery.data?.weight_kg,
    heightCm: targets.height_cm,
    birthYear: targets.birth_year,
    sex: targets.sex,
    activityFactor: targets.activity_factor,
    exerciseKcal: burned,
    currentYear: new Date().getFullYear(),
  })

  return (
    <div className="page">
      <div className="day-nav">
        <button className="btn btn--icon" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day">
          ‹
        </button>
        <button className="day-nav__label" onClick={() => setPicker(true)}>
          {formatDayLabel(day)}
        </button>
        <button
          className="btn btn--icon"
          onClick={() => setDay(shiftDay(day, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      <div className="log-actions">
        <button className="btn btn--ghost" onClick={() => setFoodMeal('auto')}>
          🍎 Food
        </button>
        <button className="btn btn--ghost" onClick={() => setModal('exercise')}>
          🏃 Exercise
        </button>
        <button className="btn btn--ghost" onClick={() => setModal('metric')}>
          ⚖️ Body
        </button>
      </div>

      <div className="view-toggle">
        <div className="seg" role="group" aria-label="View detail">
          <button className={`seg__btn ${simple ? 'is-active' : ''}`} onClick={() => setSimple(true)}>
            Simple
          </button>
          <button className={`seg__btn ${!simple ? 'is-active' : ''}`} onClick={() => setSimple(false)}>
            Detailed
          </button>
        </div>
      </div>

      <EnergySummary
        totals={totals}
        targets={targets}
        stayingPower={stayingPower}
        burned={burned}
        burnedBreakdown={burnedDetail}
        entries={entries}
        isToday={isToday}
        currentWeightKg={latestWeightQuery.data?.weight_kg ?? null}
        simple={simple}
      />

      {metric && (metric.weight_kg != null || metric.body_fat_pct != null) && (
        <MetricCard
          day={day}
          metric={metric}
          previousWeightKg={priorWeighIn?.weight_kg ?? null}
          previousWeighInDate={priorWeighIn?.date ?? null}
        />
      )}

      {entriesQuery.isLoading ? (
        <p className="muted">Loading…</p>
      ) : entriesQuery.isError ? (
        <p className="error-text">Couldn't load entries. Is the backend running?</p>
      ) : (
        // All four meals always render (even empty) so logging can start from any meal.
        groups.map((g) => (
          <MealSection
            key={g.meal}
            group={g}
            savingId={update.isPending ? (update.variables?.id ?? null) : null}
            showMacros={!simple}
            onSave={(id, patch) => update.mutate({ id, patch })}
            onDelete={(id) => remove.mutate(id)}
            onAdd={(meal) => setFoodMeal(meal)}
          />
        ))
      )}

      <ExerciseSection day={day} />

      {foodMeal !== null && (
        <Modal onClose={() => setFoodMeal(null)}>
          <CapturePage
            day={day}
            initialMeal={foodMeal === 'auto' ? undefined : foodMeal}
            onLogged={() => setFoodMeal(null)}
          />
        </Modal>
      )}
      {modal === 'exercise' && (
        <Modal title="Exercise" onClose={() => setModal(null)}>
          <AddExercise day={day} currentSteps={metric?.steps ?? null} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'metric' && (
        <Modal title="Weight & body fat" onClose={() => setModal(null)}>
          <MetricEditor day={day} metric={metric} onDone={() => setModal(null)} />
        </Modal>
      )}
      {picker && (
        <Modal title="Jump to day" onClose={() => setPicker(false)}>
          <DayPicker
            selected={day}
            onSelect={(d) => {
              setDay(d)
              setPicker(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
