import { describe, expect, it } from 'vitest'
import { DEFAULT_TARGETS, fiberGramTarget, goalProgressStart } from './targets'

describe('fiberGramTarget', () => {
  it('derives fiber from calories at 14g per 1000 kcal', () => {
    expect(fiberGramTarget(DEFAULT_TARGETS)).toBe(28)
    expect(fiberGramTarget({ ...DEFAULT_TARGETS, calorie_target: 1800 })).toBeCloseTo(25.2)
  })
})

describe('goalProgressStart', () => {
  it('ignores old below-goal weights when the current goal is weight loss', () => {
    expect(goalProgressStart([205, 195, 200, 180, 210], 210, 185)).toBe(210)
  })

  it('uses the high-water mark for an in-progress decrease goal', () => {
    expect(goalProgressStart([205, 210, 206], 206, 185)).toBe(210)
  })

  it('starts after the latest goal-side crossing for a decrease goal', () => {
    expect(goalProgressStart([230, 180, 210], 210, 185)).toBe(210)
  })

  it('starts after the latest goal-side crossing for an increase goal', () => {
    expect(goalProgressStart([140, 185, 150, 160], 160, 180)).toBe(150)
  })

  it('returns the goal when the current value is exactly at goal', () => {
    expect(goalProgressStart([210, 205], 185, 185)).toBe(185)
  })
})
