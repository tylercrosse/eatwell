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
import { getRecentFoods } from '../api/foods'
import { getLatestMetric, getMetrics } from '../api/metrics'
import { getTargets } from '../api/targets'
import { formatDayLabel, localDayKey, shiftDay } from '../lib/date'
import { sumTotals } from '../lib/totals'
import { fullnessBreakdown, fullnessScores } from '../lib/fullness'
import { stepsToKcal } from '../lib/activity'
import { expenditureBreakdown } from '../lib/energy'
import { groupByMeal } from '../lib/meals'
import { DEFAULT_TARGETS } from '../lib/targets'
import type { EntryCreate } from '../types'

interface Props {
  day: string
  setDay: (day: string) => void
}

export function LogPage({ day, setDay }: Props) {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<'food' | 'metric' | 'exercise' | null>(null)
  const [picker, setPicker] = useState(false)

  const entriesQuery = useQuery({ queryKey: ['entries', day], queryFn: () => getEntries(day) })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })
  const metricQuery = useQuery({ queryKey: ['metrics', day, day], queryFn: () => getMetrics(day, day) })
  const latestWeightQuery = useQuery({ queryKey: ['metrics', 'latest'], queryFn: getLatestMetric })
  const exerciseQuery = useQuery({ queryKey: ['exercise', day], queryFn: () => getExercise(day) })
  // Your recent foods → the cohort the fullness explainer ranks each food against
  // ("more filling than X% of your foods"). Frecency-ranked, broad sample, day-independent.
  const recentQuery = useQuery({
    queryKey: ['foods', 'recent', 'cohort'],
    queryFn: () => getRecentFoods(undefined, 'frecency', 100),
  })

  // An edit can move an entry to another day, so invalidate all day lists + the trends range.
  const invalidateEntries = () => {
    queryClient.invalidateQueries({ queryKey: ['entries'] })
    queryClient.invalidateQueries({ queryKey: ['entries-range'] })
  }
  const remove = useMutation({ mutationFn: deleteEntry, onSuccess: invalidateEntries })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<EntryCreate> }) => patchEntry(id, patch),
    onSuccess: invalidateEntries,
  })

  const entries = entriesQuery.data ?? []
  const totals = sumTotals(entries)
  const fullness = fullnessBreakdown(entries)
  const cohort = fullnessScores(recentQuery.data ?? [])
  const groups = groupByMeal(entries)
  const isToday = day === localDayKey()
  const metric = metricQuery.data?.[0]

  // Net-calorie expenditure for the day: logged exercise + step-derived burn. Steps use the
  // most recent logged weight (you needn't weigh in daily), not just this day's.
  const exerciseKcal = (exerciseQuery.data ?? []).reduce((sum, e) => sum + e.calories, 0)
  const expenditure = exerciseKcal + stepsToKcal(metric?.steps, latestWeightQuery.data?.weight_kg)

  // Full expenditure split (BMR + baseline + exercise) for the 3-ring view; null if the profile is
  // incomplete, in which case EnergySummary falls back to the Consumed/Remaining view.
  const targets = targetsQuery.data ?? DEFAULT_TARGETS
  const expenditureDetail = expenditureBreakdown({
    weightKg: latestWeightQuery.data?.weight_kg,
    heightCm: targets.height_cm,
    birthYear: targets.birth_year,
    sex: targets.sex,
    activityFactor: targets.activity_factor,
    exerciseKcal: expenditure,
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
        <button className="btn btn--ghost" onClick={() => setModal('food')}>
          🍎 Food
        </button>
        <button className="btn btn--ghost" onClick={() => setModal('exercise')}>
          🏃 Exercise
        </button>
        <button className="btn btn--ghost" onClick={() => setModal('metric')}>
          ⚖️ Body
        </button>
      </div>

      <EnergySummary
        totals={totals}
        targets={targets}
        fullness={fullness}
        fullnessCohort={cohort}
        expenditure={expenditure}
        expenditureBreakdown={expenditureDetail}
        entries={entries}
        isToday={isToday}
        currentWeightKg={latestWeightQuery.data?.weight_kg ?? null}
      />

      {metric && (metric.weight_kg != null || metric.body_fat_pct != null) && (
        <MetricCard day={day} metric={metric} />
      )}

      {entriesQuery.isLoading ? (
        <p className="muted">Loading…</p>
      ) : entriesQuery.isError ? (
        <p className="error-text">Couldn't load entries. Is the backend running?</p>
      ) : entries.length === 0 ? (
        <p className="empty">No food logged yet. Tap "Food" to start.</p>
      ) : (
        groups.map((g) => (
          <MealSection
            key={g.meal}
            group={g}
            savingId={update.isPending ? (update.variables?.id ?? null) : null}
            onSave={(id, patch) => update.mutate({ id, patch })}
            onDelete={(id) => remove.mutate(id)}
            cohort={cohort}
          />
        ))
      )}

      <ExerciseSection day={day} />

      {modal === 'food' && (
        <Modal onClose={() => setModal(null)}>
          <CapturePage day={day} onLogged={() => setModal(null)} />
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
