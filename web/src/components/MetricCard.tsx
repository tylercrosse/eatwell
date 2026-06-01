import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NumberField } from './NumberField'
import { deleteMetric, postMetric } from '../api/metrics'
import { displayToKg, kgToDisplay, useWeightUnit } from '../lib/units'
import { round } from '../lib/totals'
import type { BodyMetric } from '../types'

const round1 = (n: number) => Math.round(n * 10) / 10

interface Props {
  day: string // the day key being viewed; the metric is upserted for this date
  metric: BodyMetric // only rendered on days that already have a logged metric
}

/** The day's weight / body-fat shown on the Log page like an entry row: a display row
 *  with the same edit + delete buttons, plus an inline edit form. */
export function MetricCard({ day, metric }: Props) {
  const queryClient = useQueryClient()
  const [unit] = useWeightUnit()
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState<number | null>(null)
  const [bodyFat, setBodyFat] = useState<number | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['metrics'] })
  const save = useMutation({
    mutationFn: postMetric,
    onSuccess: () => {
      invalidate()
      setEditing(false)
    },
  })
  const remove = useMutation({ mutationFn: deleteMetric, onSuccess: invalidate })

  function openEdit() {
    setWeight(metric.weight_kg != null ? round1(kgToDisplay(metric.weight_kg, unit)) : null)
    setBodyFat(metric.body_fat_pct ?? null)
    setEditing(true)
  }

  if (editing) {
    const canSave = weight != null || bodyFat != null
    // Send both fields explicitly so clearing one persists as cleared (the quick-log card
    // on Trends omits blanks to *preserve*; here the form is the authoritative value).
    const submit = () =>
      save.mutate({
        date: day,
        weight_kg: weight == null ? null : displayToKg(weight, unit),
        body_fat_pct: bodyFat,
      })
    return (
      <div className="card entry entry--editing">
        <div className="entry-edit">
          <span className="field__label">Body metrics</span>
          <div className="macros">
            <NumberField label="Weight" unit={unit} min={0} value={weight} onChange={setWeight} />
            <NumberField label="Body fat" unit="%" min={0} value={bodyFat} onChange={setBodyFat} />
          </div>
          {save.isError && <p className="error-text">Couldn't save. Try again.</p>}
          <div className="estimate__actions">
            <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={save.isPending}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={!canSave || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const parts: string[] = []
  if (metric.weight_kg != null) parts.push(`${round1(kgToDisplay(metric.weight_kg, unit))} ${unit}`)
  if (metric.body_fat_pct != null) parts.push(`${round(metric.body_fat_pct)}% body fat`)

  return (
    <div className="card entry">
      <div className="entry__main">
        <span className="entry__name">Body</span>
        <span className="entry__macros">{parts.join(' · ')}</span>
        {metric.note && <span className="entry__meta">{metric.note}</span>}
      </div>
      <button className="entry__action" aria-label="Edit body metrics" onClick={openEdit}>
        ✎
      </button>
      <button
        className="entry__delete"
        aria-label="Delete body metrics"
        onClick={() => remove.mutate(metric.id)}
      >
        ✕
      </button>
    </div>
  )
}
