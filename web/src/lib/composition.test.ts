import { describe, expect, it } from 'vitest'
import { bodyFatPctFromMass, fatMassKg, leanMassKg, predictBodyFatSeries } from './composition'

describe('lean / fat mass split', () => {
  it('splits weight into lean and fat that sum to the total', () => {
    expect(leanMassKg(80, 25)).toBeCloseTo(60)
    expect(fatMassKg(80, 25)).toBeCloseTo(20)
    expect(leanMassKg(80, 25) + fatMassKg(80, 25)).toBeCloseTo(80)
  })

  it('handles the 0% and 100% extremes', () => {
    expect(fatMassKg(70, 0)).toBe(0)
    expect(leanMassKg(70, 100)).toBe(0)
  })
})

describe('bodyFatPctFromMass', () => {
  it('round-trips fat mass back to a percentage', () => {
    expect(bodyFatPctFromMass(80, 20)).toBeCloseTo(25)
  })

  it('clamps to [0, 100]', () => {
    expect(bodyFatPctFromMass(80, -5)).toBe(0)
    expect(bodyFatPctFromMass(80, 100)).toBe(100)
  })

  it('returns null for non-positive weight (no divide-by-zero)', () => {
    expect(bodyFatPctFromMass(0, 10)).toBeNull()
    expect(bodyFatPctFromMass(-1, 10)).toBeNull()
  })
})

describe('predictBodyFatSeries', () => {
  it('falls as predicted weight falls when lean is held constant', () => {
    // lean = 60 kg. As weight drops 80 → 78 → 76, all loss is fat, so BF% declines.
    const out = predictBodyFatSeries({ predWeightKg: [80, 78, 76], leanKg: 60 })
    expect(out[0]).toBeCloseTo(25) // (80-60)/80
    expect(out[1]).toBeCloseTo((18 / 78) * 100)
    expect(out[2]).toBeCloseTo((16 / 76) * 100)
    expect((out[0] as number) > (out[1] as number)).toBe(true)
    expect((out[1] as number) > (out[2] as number)).toBe(true)
  })

  it('matches the anchor body fat at the anchor weight', () => {
    // 80 kg at 25% → lean 60. Holding lean, the anchor day reports 25% back.
    const leanKg = leanMassKg(80, 25)
    const out = predictBodyFatSeries({ predWeightKg: [80], leanKg })
    expect(out[0]).toBeCloseTo(25)
  })

  it('preserves nulls (no forecast before the anchor)', () => {
    const out = predictBodyFatSeries({ predWeightKg: [null, null, 80], leanKg: 60 })
    expect(out).toEqual([null, null, 25])
  })
})
