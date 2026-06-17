import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NumberField } from './NumberField'
import { deleteExercise, getExercise, patchExercise } from '../api/exercise'
import { deleteMetric, getLatestMetric, getMetrics, patchMetric } from '../api/metrics'
import { stepsToKcal } from '../lib/activity'
import { round } from '../lib/totals'
import type { BodyMetric, ExerciseCreate, ExerciseEntry } from '../types'

/** A day's activity, shown on the Log page like a meal section: an editable steps row
 *  (with its derived burn) plus logged workouts. Self-fetches; hidden when there's neither. */
export function ExerciseSection({ day }: { day: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['exercise', day], queryFn: () => getExercise(day) })
  const metricQuery = useQuery({ queryKey: ['metrics', day, day], queryFn: () => getMetrics(day, day) })
  const latestWeightQuery = useQuery({ queryKey: ['metrics', 'latest'], queryFn: getLatestMetric })
  const entries = data ?? []
  const metric = metricQuery.data?.[0]
  const steps = metric?.steps ?? null
  // Use the most recent logged weight (not just this day's) for the step→kcal estimate.
  const stepKcal = stepsToKcal(steps, latestWeightQuery.data?.weight_kg)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['exercise'] })
    queryClient.invalidateQueries({ queryKey: ['trends-history'] })
  }
  const remove = useMutation({ mutationFn: deleteExercise, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<ExerciseCreate> }) => patchExercise(id, patch),
    onSuccess: invalidate,
  })

  if (entries.length === 0 && steps == null) return null
  const burned = entries.reduce((sum, e) => sum + e.calories, 0) + stepKcal

  return (
    <section className="meal-section">
      <header className="meal-section__header">
        <span className="meal-section__title">Exercise</span>
        <span className="meal-section__totals">−{round(burned)} kcal burned</span>
      </header>
      <ul className="entry-list">
        {steps != null && metric && <StepsRow metric={metric} stepKcal={stepKcal} />}
        {entries.map((e) => (
          <ExerciseRow
            key={e.id}
            entry={e}
            saving={update.isPending && update.variables?.id === e.id}
            onSave={(id, patch) => update.mutate({ id, patch })}
            onDelete={(id) => remove.mutate(id)}
          />
        ))}
      </ul>
    </section>
  )
}

interface RowProps {
  entry: ExerciseEntry
  saving: boolean
  onSave: (id: number, patch: Partial<ExerciseCreate>) => void
  onDelete: (id: number) => void
}

function ExerciseRow({ entry, saving, onSave, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(entry.description)
  const [calories, setCalories] = useState<number | null>(entry.calories)
  const [duration, setDuration] = useState<number | null>(entry.duration_min)

  function openEdit() {
    setDescription(entry.description)
    setCalories(entry.calories)
    setDuration(entry.duration_min)
    setEditing(true)
  }

  if (editing) {
    return (
      <li className="card entry entry--editing">
        <div className="entry-edit">
          <label className="field">
            <span className="field__label">Activity</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="macros">
            <NumberField label="Calories" unit="kcal" min={0} value={calories} onChange={setCalories} />
            <NumberField label="Duration" unit="min" min={0} value={duration} onChange={setDuration} />
          </div>
          <div className="estimate__actions">
            <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={saving}
              onClick={() => {
                onSave(entry.id, {
                  description: description.trim() || entry.description,
                  calories: calories ?? 0,
                  duration_min: duration,
                })
                setEditing(false)
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  const meta = [
    entry.duration_min != null ? `${round(entry.duration_min)} min` : null,
    entry.source === 'ai' ? 'AI estimate' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="card entry">
      <div className="entry__main">
        <span className="entry__name">{entry.description}</span>
        {meta && <span className="entry__meta">{meta}</span>}
      </div>
      <div className="entry__right">
        <span className="entry__cal entry__cal--burn">−{round(entry.calories)}</span>
        <span className="entry__cal-unit">kcal</span>
      </div>
      <button className="entry__action" aria-label="Edit exercise" onClick={openEdit}>
        ✎
      </button>
      <button className="entry__delete" aria-label="Delete exercise" onClick={() => onDelete(entry.id)}>
        ✕
      </button>
    </li>
  )
}

/** The day's steps row, with the same edit/delete affordances as a workout. */
function StepsRow({ metric, stepKcal }: { metric: BodyMetric; stepKcal: number }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [steps, setSteps] = useState<number | null>(metric.steps)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] })
    queryClient.invalidateQueries({ queryKey: ['trends-history'] })
  }
  const patch = useMutation({
    mutationFn: (s: number | null) => patchMetric(metric.id, { steps: s }),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: deleteMetric, onSuccess: invalidate })
  const saving = patch.isPending || remove.isPending

  function removeSteps() {
    // Drop the whole row if it's steps-only; otherwise just clear steps (keep weight/body fat).
    if (metric.weight_kg == null && metric.body_fat_pct == null) remove.mutate(metric.id)
    else patch.mutate(null)
  }

  if (editing) {
    return (
      <li className="card entry entry--editing">
        <div className="entry-edit">
          <NumberField label="Steps" min={0} step={1} value={steps} onChange={setSteps} />
          <div className="estimate__actions">
            <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={steps == null || saving}
              onClick={() => {
                patch.mutate(steps)
                setEditing(false)
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="card entry">
      <div className="entry__main">
        <span className="entry__name">👟 Steps</span>
        <span className="entry__meta">
          {(metric.steps ?? 0).toLocaleString()} steps{stepKcal > 0 ? '' : ' · log weight for kcal'}
        </span>
      </div>
      {stepKcal > 0 && (
        <div className="entry__right">
          <span className="entry__cal entry__cal--burn">−{round(stepKcal)}</span>
          <span className="entry__cal-unit">kcal</span>
        </div>
      )}
      <button
        className="entry__action"
        aria-label="Edit steps"
        onClick={() => {
          setSteps(metric.steps)
          setEditing(true)
        }}
      >
        ✎
      </button>
      <button className="entry__delete" aria-label="Delete steps" onClick={removeSteps}>
        ✕
      </button>
    </li>
  )
}
