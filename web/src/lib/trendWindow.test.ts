import { describe, expect, it } from 'vitest'
import {
  allTrendWindow,
  defaultTrendWindow,
  indexFromClientX,
  indexFromTrackX,
  panTrendWindow,
  resizeTrendWindowEdge,
  trailingTrendWindow,
  trendWindowEndingAt,
  zoomTrendWindow,
  zoomTrendWindowByFactor,
} from './trendWindow'

describe('trend window helpers', () => {
  it('defaults to the trailing 30 days when history is longer', () => {
    expect(defaultTrendWindow(100)).toEqual({ startIndex: 70, endIndex: 99 })
  })

  it('defaults to all days when history is shorter than 30 days', () => {
    expect(defaultTrendWindow(12)).toEqual({ startIndex: 0, endIndex: 11 })
  })

  it('can create a longer trailing window', () => {
    expect(trailingTrendWindow(200, 90)).toEqual({ startIndex: 110, endIndex: 199 })
  })

  it('can create a window ending at an anchored index', () => {
    expect(trendWindowEndingAt(271, 180, 30)).toEqual({ startIndex: 151, endIndex: 180 })
    expect(trendWindowEndingAt(271, 180, 180)).toEqual({ startIndex: 1, endIndex: 180 })
  })

  it('returns the full history window', () => {
    expect(allTrendWindow(42)).toEqual({ startIndex: 0, endIndex: 41 })
  })

  it('pans and clamps at both ends', () => {
    const w = { startIndex: 70, endIndex: 99 }
    expect(panTrendWindow(w, 120, 5)).toEqual({ startIndex: 75, endIndex: 104 })
    expect(panTrendWindow(w, 120, -100)).toEqual({ startIndex: 0, endIndex: 29 })
    expect(panTrendWindow(w, 120, 100)).toEqual({ startIndex: 90, endIndex: 119 })
  })

  it('zooms around an anchor while preserving its relative position', () => {
    const w = { startIndex: 70, endIndex: 99 }
    expect(zoomTrendWindow(w, 120, 14, 84.5)).toEqual({ startIndex: 78, endIndex: 91 })
  })

  it('enforces a 7-day minimum zoom', () => {
    expect(zoomTrendWindowByFactor({ startIndex: 20, endIndex: 49 }, 100, 0.01, 35)).toEqual({
      startIndex: 32,
      endIndex: 38,
    })
  })

  it('resizes either edge and clamps to the minimum size', () => {
    expect(resizeTrendWindowEdge({ startIndex: 20, endIndex: 49 }, 100, 'start', 10)).toEqual({
      startIndex: 30,
      endIndex: 49,
    })
    expect(resizeTrendWindowEdge({ startIndex: 20, endIndex: 49 }, 100, 'end', -100)).toEqual({
      startIndex: 20,
      endIndex: 26,
    })
  })

  it('maps chart and scrubber pixels to fractional indexes', () => {
    expect(indexFromClientX(150, 100, 200, { startIndex: 20, endIndex: 29 })).toBeCloseTo(22.25)
    expect(indexFromTrackX(150, 100, 200, 101)).toBeCloseTo(25)
  })
})
