import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NumberField } from './NumberField'
import { postMetric } from '../api/metrics'
import { displayToKg, kgToDisplay, useWeightUnit } from '../lib/units'
import { round1 } from '../lib/totals'
import type { BodyMetric } from '../types'

interface Props {
  day: string // the date this metric is upserted for
  metric?: BodyMetric // existing values to seed (edit); omitted = adding
  onDone: () => void // close after a successful save or cancel
}

/** Weight + body-fat edit form, shared by the Log-page metric card (edit) and the
 *  "+ Weight / Body fat" add action. Sends both fields explicitly so clearing persists. */
export function MetricEditor({ day, metric, onDone }: Props) {
  const queryClient = useQueryClient()
  const [unit] = useWeightUnit()
  const [weight, setWeight] = useState<number | null>(
    metric?.weight_kg != null ? round1(kgToDisplay(metric.weight_kg, unit)) : null,
  )
  const [bodyFat, setBodyFat] = useState<number | null>(metric?.body_fat_pct ?? null)

  const save = useMutation({
    mutationFn: postMetric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['trends-history'] })
      onDone()
    },
  })

  const canSave = weight != null || bodyFat != null

  return (
    <div className="entry-edit">
      <div className="macros">
        <NumberField label="Weight" unit={unit} min={0} value={weight} onChange={setWeight} />
        <NumberField label="Body fat" unit="%" min={0} value={bodyFat} onChange={setBodyFat} />
      </div>
      {save.isError && <p className="error-text">Couldn't save. Try again.</p>}
      <div className="estimate__actions">
        <button className="btn btn--ghost" onClick={onDone} disabled={save.isPending}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          disabled={!canSave || save.isPending}
          onClick={() =>
            save.mutate({
              date: day,
              weight_kg: weight == null ? null : displayToKg(weight, unit),
              body_fat_pct: bodyFat,
            })
          }
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
