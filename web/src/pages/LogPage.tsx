import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DailyTotals } from '../components/DailyTotals'
import { EntryList } from '../components/EntryList'
import { deleteEntry, getEntries } from '../api/entries'
import { formatDayLabel, localDayKey, shiftDay } from '../lib/date'
import { sumTotals } from '../lib/totals'

export function LogPage() {
  const queryClient = useQueryClient()
  const [day, setDay] = useState<string>(localDayKey())

  const entriesQuery = useQuery({
    queryKey: ['entries', day],
    queryFn: () => getEntries(day),
  })

  const remove = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries', day] }),
  })

  const entries = entriesQuery.data ?? []
  const totals = sumTotals(entries)
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

      <DailyTotals totals={totals} />

      {entriesQuery.isLoading ? (
        <p className="muted">Loading…</p>
      ) : entriesQuery.isError ? (
        <p className="error-text">Couldn't load entries. Is the backend running?</p>
      ) : (
        <EntryList entries={entries} onDelete={(id) => remove.mutate(id)} />
      )}
    </div>
  )
}
