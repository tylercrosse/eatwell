import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AppIcon } from './AppIcon'
import { NumberField } from './NumberField'
import { postEstimateActivity } from '../api/estimate'
import { postExercise } from '../api/exercise'
import { postMetric } from '../api/metrics'
import { ApiError } from '../api/client'

interface Props {
  day: string
  currentSteps: number | null // the day's logged steps, to prefill
  onDone: () => void
}

/** Log a day's activity: today's step count and/or a workout (with optional AI estimate). */
export function AddExercise({ day, currentSteps, onDone }: Props) {
  const queryClient = useQueryClient()
  const [steps, setSteps] = useState<number | null>(currentSteps)
  const [description, setDescription] = useState('')
  const [calories, setCalories] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [source, setSource] = useState<'manual' | 'ai'>('manual')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estimate = useMutation({
    mutationFn: postEstimateActivity,
    onMutate: () => setError(null),
    onSuccess: (res) => {
      if (!description.trim()) setDescription(res.name)
      setCalories(Math.round(res.calories))
      setDuration(res.duration_min ?? null)
      setSource('ai')
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status === 502
          ? "Couldn't estimate that — try again or enter calories manually."
          : 'Something went wrong.',
      ),
  })

  const hasWorkout = description.trim().length > 0 && calories != null
  const stepsChanged = steps !== currentSteps
  const canSave = hasWorkout || (steps != null && stepsChanged)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const tasks: Promise<unknown>[] = []
      if (steps != null && stepsChanged) tasks.push(postMetric({ date: day, steps }))
      if (hasWorkout) {
        tasks.push(
          postExercise({
            date: day,
            description: description.trim(),
            calories: calories ?? 0,
            duration_min: duration,
            source,
          }),
        )
      }
      await Promise.all(tasks)
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['exercise'] })
      queryClient.invalidateQueries({ queryKey: ['trends-history'] })
      onDone()
    } catch {
      setError("Couldn't save. Try again.")
      setSaving(false)
    }
  }

  return (
    <div className="entry-edit">
      <NumberField label="Steps today" min={0} step={1} value={steps} onChange={setSteps} />

      <div className="add-exercise__divider">Log a workout</div>

      <label className="field">
        <span className="field__label">Activity</span>
        <input
          type="text"
          value={description}
          placeholder="e.g. 30 min easy lifting"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <button
        className="btn btn--ghost"
        disabled={!description.trim() || estimate.isPending}
        onClick={() => estimate.mutate(description.trim())}
      >
        {estimate.isPending ? (
          'Estimating…'
        ) : (
          <span className="icon-label">
            <AppIcon name="sparkles" size={18} />
            <span>Estimate calories</span>
          </span>
        )}
      </button>
      <div className="macros">
        <NumberField label="Calories" unit="kcal" min={0} value={calories} onChange={setCalories} />
        <NumberField label="Duration" unit="min" min={0} value={duration} onChange={setDuration} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="estimate__actions">
        <button className="btn btn--ghost" onClick={onDone} disabled={saving}>
          Cancel
        </button>
        <button className="btn btn--primary" disabled={!canSave || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
