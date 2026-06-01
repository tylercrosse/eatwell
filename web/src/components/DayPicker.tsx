import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEntriesRange } from '../api/entries'
import { getMetrics } from '../api/metrics'
import {
  addMonths,
  formatMonthLabel,
  localDayKey,
  monthBounds,
  monthMatrix,
  monthOf,
} from '../lib/date'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface Props {
  selected: string
  onSelect: (day: string) => void
}

/** Month calendar: jump to any past day; days with a food entry or body metric are dotted. */
export function DayPicker({ selected, onSelect }: Props) {
  const today = localDayKey()
  const [anchor, setAnchor] = useState(selected) // any day in the displayed month
  const { start, end } = monthBounds(anchor)

  const entriesQuery = useQuery({
    queryKey: ['entries-range', start, end],
    queryFn: () => getEntriesRange(start, end),
  })
  const metricsQuery = useQuery({ queryKey: ['metrics', start, end], queryFn: () => getMetrics(start, end) })

  const marked = new Set<string>()
  entriesQuery.data?.forEach((d) => d.entry_count > 0 && marked.add(d.date))
  metricsQuery.data?.forEach((m) => marked.add(m.date))

  const month = monthOf(anchor)

  return (
    <div className="daypicker">
      <div className="daypicker__head">
        <button className="btn btn--icon" aria-label="Previous month" onClick={() => setAnchor(addMonths(anchor, -1))}>
          ‹
        </button>
        <span className="daypicker__month">{formatMonthLabel(anchor)}</span>
        <button
          className="btn btn--icon"
          aria-label="Next month"
          disabled={month >= monthOf(today)}
          onClick={() => setAnchor(addMonths(anchor, 1))}
        >
          ›
        </button>
      </div>

      <div className="daypicker__dow">
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="daypicker__grid">
        {monthMatrix(anchor)
          .flat()
          .map((dk) => {
            const inMonth = monthOf(dk) === month
            const isFuture = dk > today
            const classes = [
              'daypicker__day',
              inMonth ? '' : 'is-muted',
              dk === selected ? 'is-selected' : '',
              dk === today ? 'is-today' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={dk}
                className={classes}
                disabled={isFuture}
                onClick={() => onSelect(dk)}
              >
                {Number(dk.slice(8, 10))}
                {marked.has(dk) && <span className="daypicker__dot" />}
              </button>
            )
          })}
      </div>
    </div>
  )
}
