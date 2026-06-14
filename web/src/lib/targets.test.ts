import { describe, expect, it } from 'vitest'
import { DEFAULT_TARGETS, fiberGramTarget } from './targets'

describe('fiberGramTarget', () => {
  it('derives fiber from calories at 14g per 1000 kcal', () => {
    expect(fiberGramTarget(DEFAULT_TARGETS)).toBe(28)
    expect(fiberGramTarget({ ...DEFAULT_TARGETS, calorie_target: 1800 })).toBeCloseTo(25.2)
  })
})
