import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EnergySummary } from '../components/EnergySummary'
import { MealSection } from '../components/MealSection'
import { deleteEntry, getEntries, patchEntry } from '../api/entries'
import { getTargets } from '../api/targets'
import { formatDayLabel, localDayKey, shiftDay } from '../lib/date'
import { sumTotals } from '../lib/totals'
import { densityBreakdown } from '../lib/density'
import { groupByMeal } from '../lib/meals'
import { DEFAULT_TARGETS } from '../lib/targets'
import type { EntryCreate } from '../types'

export function LogPage() {
  const queryClient = useQueryClient()
  const [day, setDay] = useState<string>(localDayKey())

  const entriesQuery = useQuery({
    queryKey: ['entries', day],
    queryFn: () => getEntries(day),
  })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })

  const invalidateDay = () => queryClient.invalidateQueries({ queryKey: ['entries', day] })

  const remove = useMutation({ mutationFn: deleteEntry, onSuccess: invalidateDay })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<EntryCreate> }) => patchEntry(id, patch),
    onSuccess: invalidateDay,
  })

  const entries = entriesQuery.data ?? []
  const totals = sumTotals(entries)
  const density = densityBreakdown(entries)
  const groups = groupByMeal(entries)
  const isToday = day === localDayKey()

  return (
    <div className="page">
      <div className="day-nav">
        <button className="btn btn--icon" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day">
          ‹
        </button>
        <span className="day-nav__label">{formatDayLabel(day)}</span>
        <button
          className="btn btn--icon"
          onClick={() => setDay(shiftDay(day, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      <EnergySummary totals={totals} targets={targetsQuery.data ?? DEFAULT_TARGETS} density={density} />

      {entriesQuery.isLoading ? (
        <p className="muted">Loading…</p>
      ) : entriesQuery.isError ? (
        <p className="error-text">Couldn't load entries. Is the backend running?</p>
      ) : entries.length === 0 ? (
        <p className="empty">No entries yet. Snap a photo to get started.</p>
      ) : (
        groups.map((g) => (
          <MealSection
            key={g.meal}
            group={g}
            savingId={update.isPending ? (update.variables?.id ?? null) : null}
            onSave={(id, patch) => update.mutate({ id, patch })}
            onDelete={(id) => remove.mutate(id)}
          />
        ))
      )}
    </div>
  )
}
