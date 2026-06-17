import { describe, expect, it } from 'vitest'
import { ema, emaByDate, interpolateByDate, movingAverage } from './stats'

describe('movingAverage', () => {
  it('is null until the window fills, then trails', () => {
    expect(movingAverage([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
  })
})

describe('ema', () => {
  it('seeds with the first value and blends by alpha', () => {
    const out = ema([10, 20], 0.5)
    expect(out[0]).toBe(10)
    expect(out[1]).toBeCloseTo(15) // 0.5*20 + 0.5*10
  })
})

describe('emaByDate', () => {
  it('reduces to a plain daily EMA when samples are one day apart', () => {
    const dated = emaByDate(
      [
        { date: '2026-06-01', value: 10 },
        { date: '2026-06-02', value: 20 },
        { date: '2026-06-03', value: 30 },
      ],
      0.3,
    )
    expect(dated).toEqual(ema([10, 20, 30], 0.3))
  })

  it('lets a large gap track the new value (the stale trend decays away)', () => {
    const out = emaByDate(
      [
        { date: '2026-03-01', value: 80 },
        { date: '2026-06-01', value: 90 }, // ~92 days later
      ],
      0.3,
    )
    // 92-day gap → effective alpha ≈ 1, so the result is essentially the recent reading.
    expect(out[1]).toBeGreaterThan(89.99)
    expect(out[1]).toBeLessThanOrEqual(90)
  })

  it('handles a single sample', () => {
    expect(emaByDate([{ date: '2026-06-01', value: 75 }], 0.3)).toEqual([75])
  })

  it('clamps same-day samples to a one-day step (still blends the new reading)', () => {
    const out = emaByDate(
      [
        { date: '2026-06-01', value: 100 },
        { date: '2026-06-01', value: 110 },
      ],
      0.3,
    )
    expect(out[1]).toBeCloseTo(0.3 * 110 + 0.7 * 100)
  })
})

describe('interpolateByDate', () => {
  it('fills daily values between dated samples', () => {
    const out = interpolateByDate(
      [
        { date: '2026-06-01', value: 80 },
        { date: '2026-06-04', value: 77 },
      ],
      ['2026-05-31', '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'],
    )

    expect(out).toEqual([null, 80, 79, 78, 77, null])
  })
})
