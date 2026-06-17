import { describe, expect, it } from 'vitest'
import { bandHalfWidthKg, predictWeightSeries } from './forecast'

const axis = (...days: string[]) => days

describe('predictWeightSeries', () => {
  it('holds weight when net intake is flat', () => {
    const out = predictWeightSeries({
      axis: axis('2026-06-01', '2026-06-02', '2026-06-03'),
      anchorKg: 80,
      anchorDate: '2026-06-01',
      todayKey: '2026-06-03',
      netByDay: new Map(),
      avgDailyKg: 0,
    })
    expect(out).toEqual([80, 80, 80])
  })

  it('trends down at 1 kg per 7700 kcal deficit', () => {
    const out = predictWeightSeries({
      axis: axis('2026-06-01', '2026-06-02', '2026-06-03'),
      anchorKg: 80,
      anchorDate: '2026-06-01',
      todayKey: '2026-06-03',
      netByDay: new Map([
        ['2026-06-02', -7700],
        ['2026-06-03', -7700],
      ]),
      avgDailyKg: 0,
    })
    expect(out).toEqual([80, 79, 78])
  })

  it('is null before the anchor (forecast forward only)', () => {
    const out = predictWeightSeries({
      axis: axis('2026-05-30', '2026-05-31', '2026-06-01'),
      anchorKg: 80,
      anchorDate: '2026-06-01',
      todayKey: '2026-06-01',
      netByDay: new Map(),
      avgDailyKg: 0,
    })
    expect(out).toEqual([null, null, 80])
  })

  it('extrapolates future days at the recent average and clamps at the goal', () => {
    const out = predictWeightSeries({
      axis: axis('2026-06-01', '2026-06-02', '2026-06-03'),
      anchorKg: 80,
      anchorDate: '2026-06-01',
      todayKey: '2026-06-01',
      netByDay: new Map(),
      avgDailyKg: -1, // would reach 78 by day 3, but the goal is 79
      goalKg: 79,
      dir: -1,
    })
    expect(out).toEqual([80, 79, 79])
  })
})

describe('bandHalfWidthKg', () => {
  it('starts at the daily-noise floor', () => {
    expect(bandHalfWidthKg(0)).toBeCloseTo(0.7)
  })

  it('widens monotonically with the horizon', () => {
    expect(bandHalfWidthKg(30)).toBeGreaterThan(bandHalfWidthKg(0))
    expect(bandHalfWidthKg(60)).toBeGreaterThan(bandHalfWidthKg(30))
  })

  it('never exceeds the cap', () => {
    expect(bandHalfWidthKg(100_000)).toBe(6)
    expect(bandHalfWidthKg(100_000, { capKg: 3 })).toBe(3)
  })
})
