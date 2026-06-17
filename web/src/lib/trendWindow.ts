export const DEFAULT_TREND_WINDOW_DAYS = 30
export const MIN_TREND_WINDOW_DAYS = 7

export interface TrendWindow {
  startIndex: number
  endIndex: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

export function windowSize(w: TrendWindow): number {
  return Math.max(0, w.endIndex - w.startIndex + 1)
}

export function allTrendWindow(total: number): TrendWindow {
  const last = Math.max(0, total - 1)
  return { startIndex: 0, endIndex: last }
}

export function clampTrendWindow(w: TrendWindow, total: number, minSize = MIN_TREND_WINDOW_DAYS): TrendWindow {
  if (total <= 1) return { startIndex: 0, endIndex: 0 }

  const requestedStart = Math.min(w.startIndex, w.endIndex)
  const requestedEnd = Math.max(w.startIndex, w.endIndex)
  const size = clamp(requestedEnd - requestedStart + 1, Math.min(minSize, total), total)
  const start = clamp(Math.round(requestedStart), 0, total - size)
  return { startIndex: start, endIndex: start + size - 1 }
}

export function defaultTrendWindow(total: number): TrendWindow {
  return trailingTrendWindow(total, DEFAULT_TREND_WINDOW_DAYS)
}

export function trailingTrendWindow(total: number, days: number): TrendWindow {
  if (total <= 1) return { startIndex: 0, endIndex: 0 }
  const size = Math.min(Math.max(1, Math.round(days)), total)
  return { startIndex: total - size, endIndex: total - 1 }
}

export function trendWindowEndingAt(total: number, endIndex: number, days: number): TrendWindow {
  if (total <= 1) return { startIndex: 0, endIndex: 0 }
  const size = Math.min(Math.max(1, Math.round(days)), total)
  const end = clamp(Math.round(endIndex), size - 1, total - 1)
  return { startIndex: end - size + 1, endIndex: end }
}

export function panTrendWindow(w: TrendWindow, total: number, deltaDays: number): TrendWindow {
  const size = windowSize(w)
  if (total <= size) return allTrendWindow(total)
  const start = clamp(Math.round(w.startIndex + deltaDays), 0, total - size)
  return { startIndex: start, endIndex: start + size - 1 }
}

export function zoomTrendWindow(
  w: TrendWindow,
  total: number,
  nextSize: number,
  anchorIndex = (w.startIndex + w.endIndex) / 2,
): TrendWindow {
  if (total <= 1) return { startIndex: 0, endIndex: 0 }

  const currentSize = Math.max(1, windowSize(w))
  const size = clamp(Math.round(nextSize), Math.min(MIN_TREND_WINDOW_DAYS, total), total)
  const anchor = clamp(anchorIndex, w.startIndex, w.endIndex)
  const ratio = currentSize <= 1 ? 0.5 : (anchor - w.startIndex) / (currentSize - 1)
  const start = clamp(Math.round(anchor - ratio * (size - 1)), 0, total - size)
  return { startIndex: start, endIndex: start + size - 1 }
}

export function zoomTrendWindowByFactor(w: TrendWindow, total: number, factor: number, anchorIndex?: number): TrendWindow {
  return zoomTrendWindow(w, total, windowSize(w) * factor, anchorIndex)
}

export function resizeTrendWindowEdge(
  w: TrendWindow,
  total: number,
  edge: 'start' | 'end',
  deltaDays: number,
): TrendWindow {
  if (total <= 1) return { startIndex: 0, endIndex: 0 }
  const minSize = Math.min(MIN_TREND_WINDOW_DAYS, total)
  const delta = Math.round(deltaDays)

  if (edge === 'start') {
    const start = clamp(w.startIndex + delta, 0, w.endIndex - minSize + 1)
    return { startIndex: start, endIndex: w.endIndex }
  }

  const end = clamp(w.endIndex + delta, w.startIndex + minSize - 1, total - 1)
  return { startIndex: w.startIndex, endIndex: end }
}

export function indexFromClientX(clientX: number, left: number, width: number, w: TrendWindow): number {
  if (width <= 0) return w.startIndex
  const ratio = clamp((clientX - left) / width, 0, 1)
  return w.startIndex + ratio * Math.max(windowSize(w) - 1, 0)
}

export function indexFromTrackX(clientX: number, left: number, width: number, total: number): number {
  if (width <= 0 || total <= 1) return 0
  const ratio = clamp((clientX - left) / width, 0, 1)
  return ratio * (total - 1)
}
