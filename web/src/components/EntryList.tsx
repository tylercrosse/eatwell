import type { Entry } from '../types'
import { formatTime } from '../lib/date'
import { round } from '../lib/totals'

interface Props {
  entries: Entry[]
  onDelete: (id: number) => void
}

export function EntryList({ entries, onDelete }: Props) {
  if (entries.length === 0) {
    return <p className="empty">No entries yet. Snap a photo to get started.</p>
  }
  return (
    <ul className="entry-list">
      {entries.map((e) => (
        <li key={e.id} className="card entry">
          <div className="entry__main">
            <span className="entry__name">{e.food_name}</span>
            <span className="entry__meta">
              {formatTime(e.logged_at)}
              {e.serving_size ? ` · ${e.serving_size}` : ''}
            </span>
            <span className="entry__macros">
              P {round(e.protein_g)} · C {round(e.carbs_g)} · F {round(e.fat_g)}
            </span>
          </div>
          <div className="entry__right">
            <span className="entry__cal">{round(e.calories)}</span>
            <span className="entry__cal-unit">kcal</span>
          </div>
          <button
            className="entry__delete"
            aria-label="Delete entry"
            onClick={() => onDelete(e.id)}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
