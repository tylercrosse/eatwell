// The backend stores timestamps naive (no timezone) and round-trips them unchanged.
// We therefore work entirely in the device's local wall-clock time: send local time
// (NOT toISOString(), which converts to UTC 'Z'), and read it back as local.

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Local calendar day key, e.g. "2026-05-31". Used for the ?date= filter. */
export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local datetime without timezone, e.g. "2026-05-31T08:30:00". Sent as logged_at. */
export function localDateTime(d: Date = new Date()): string {
  return `${localDayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Human time-of-day for display, e.g. "8:30 AM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Shift a day key by N days (for the log's prev/next navigation). */
export function shiftDay(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return localDayKey(dt)
}

/** Friendly label for a day key relative to today. */
export function formatDayLabel(dayKey: string): string {
  if (dayKey === localDayKey()) return 'Today'
  if (dayKey === shiftDay(localDayKey(), -1)) return 'Yesterday'
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
