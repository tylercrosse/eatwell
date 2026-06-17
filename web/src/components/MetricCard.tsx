import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MetricEditor } from './MetricEditor'
import { deleteMetric } from '../api/metrics'
import { kgToDisplay, useWeightUnit } from '../lib/units'
import { round, round1 } from '../lib/totals'
import { formatFullDay } from '../lib/date'
import type { BodyMetric } from '../types'

interface Props {
  day: string // the day key being viewed; the metric is upserted for this date
  metric: BodyMetric // only rendered on days that already have a logged metric
  previousWeightKg?: number | null // closest weigh-in before this day; drives the change delta
  previousWeighInDate?: string | null // that weigh-in's day key, for the delta tooltip
}

/** Signed, one-decimal change (e.g. "+0.4", "−1.2"); empty at zero so we hide a no-change delta. */
function signedDelta(n: number): string {
  const r = round1(n)
  if (r === 0) return ''
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}`
}

/** The day's weight / body-fat shown on the Log page like an entry row: a display row
 *  with the same edit + delete buttons, expanding into the shared MetricEditor. */
export function MetricCard({ day, metric, previousWeightKg, previousWeighInDate }: Props) {
  const queryClient = useQueryClient()
  const [unit] = useWeightUnit()
  const [editing, setEditing] = useState(false)

  const remove = useMutation({
    mutationFn: deleteMetric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['trends-history'] })
    },
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

  // Change vs the previous weigh-in (kg → display unit conversion is linear, so a difference converts
  // the same as a weight). Rendered as the day's right-side figure, like an entry's calories.
  const deltaText =
    metric.weight_kg != null && previousWeightKg != null
      ? signedDelta(kgToDisplay(metric.weight_kg - previousWeightKg, unit))
      : ''
  const deltaTitle =
    previousWeightKg != null && previousWeighInDate != null
      ? `Change since ${round1(kgToDisplay(previousWeightKg, unit))} ${unit} on ${formatFullDay(previousWeighInDate)}`
      : undefined

  return (
    <div className="card entry">
      <div className="entry__main">
        <span className="entry__name">Body</span>
        <span className="entry__macros">{parts.join(' · ')}</span>
        {metric.note && <span className="entry__meta">{metric.note}</span>}
      </div>
      {deltaText && (
        <div className="entry__right" title={deltaTitle}>
          <span className="entry__cal entry__cal--neutral">{deltaText}</span>
          <span className="entry__cal-unit">{unit}</span>
        </div>
      )}
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
