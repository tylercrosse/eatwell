import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MetricEditor } from './MetricEditor'
import { deleteMetric } from '../api/metrics'
import { kgToDisplay, useWeightUnit } from '../lib/units'
import { round, round1 } from '../lib/totals'
import type { BodyMetric } from '../types'

interface Props {
  day: string // the day key being viewed; the metric is upserted for this date
  metric: BodyMetric // only rendered on days that already have a logged metric
}

/** The day's weight / body-fat shown on the Log page like an entry row: a display row
 *  with the same edit + delete buttons, expanding into the shared MetricEditor. */
export function MetricCard({ day, metric }: Props) {
  const queryClient = useQueryClient()
  const [unit] = useWeightUnit()
  const [editing, setEditing] = useState(false)

  const remove = useMutation({
    mutationFn: deleteMetric,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metrics'] }),
  })

  if (editing) {
    return (
      <div className="card entry entry--editing">
        <MetricEditor day={day} metric={metric} onDone={() => setEditing(false)} />
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
      <button className="entry__action" aria-label="Edit body metrics" onClick={() => setEditing(true)}>
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
