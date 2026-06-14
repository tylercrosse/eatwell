import { describe, expect, it } from 'vitest'
import {
  fullnessBreakdown,
  fullnessExplain,
  fullnessFactor,
  fullnessPercentile,
  fullnessScores,
  isBeverageForFullness,
} from './fullness'

describe('isBeverageForFullness', () => {
  it('uses the explicit beverage flag', () => {
    expect(
      isBeverageForFullness({
        food_name: 'Orange juice',
        calories: 110,
        protein_g: 2,
        fat_g: 0,
        is_beverage: true,
      }),
    ).toBe(true)
  })

  it('does not override an explicit false flag from the name', () => {
    expect(
      isBeverageForFullness({
        food_name: 'Iced latte',
        calories: 180,
        protein_g: 8,
        fat_g: 6,
        is_beverage: false,
      }),
    ).toBe(false)
  })
})

describe('fullnessFactor', () => {
  it('caps explicit drinks at low fullness', () => {
    const f = fullnessFactor({
      food_name: 'Iced latte',
      calories: 180,
      protein_g: 8,
      fat_g: 6,
      weight_g: 355,
      is_beverage: true,
    })

    expect(f?.score).toBe(1.4)
    expect(f?.tier).toBe('low')
  })

  it('does not cap name-matched foods when the drink flag is false', () => {
    const f = fullnessFactor({
      food_name: 'Iced latte',
      calories: 180,
      protein_g: 8,
      fat_g: 6,
      weight_g: 355,
      is_beverage: false,
    })

    expect(f?.score).toBeGreaterThan(1.4)
  })
})

describe('fullnessExplain', () => {
  const yogurt = { food_name: 'Greek yogurt', calories: 120, protein_g: 20, fat_g: 0, fiber_g: 0, weight_g: 200 }

  it('returns terms that reconcile to the score', () => {
    const ex = fullnessExplain(yogurt)!
    const raw = ex.energy + ex.protein + ex.fiber + ex.fat + ex.base
    expect(ex.raw).toBeCloseTo(raw, 10)
    // Not clamped/capped here, so the score is the raw value.
    expect(ex.score).toBeCloseTo(raw, 10)
    // And the public factor agrees with the explain.
    expect(fullnessFactor(yogurt)!.score).toBeCloseTo(ex.score, 10)
  })

  it('signs the fat term as a penalty and protein/fiber as positive', () => {
    const ex = fullnessExplain({ food_name: 'Nut butter', calories: 600, protein_g: 20, fat_g: 50, fiber_g: 6, weight_g: 100 })!
    expect(ex.fat).toBeLessThan(0)
    expect(ex.protein).toBeGreaterThan(0)
    expect(ex.fiber).toBeGreaterThan(0)
  })

  it('flags the beverage cap only when it actually lowers the score', () => {
    const capped = fullnessExplain({ food_name: 'Juice', calories: 110, protein_g: 2, fat_g: 0, weight_g: 240, is_beverage: true })!
    expect(capped.beverageCapped).toBe(true)
    expect(capped.score).toBe(1.4)
    // A dense, high-fat drink already scores at/below the cap, so the cap doesn't lower it.
    const cream = fullnessExplain({ food_name: 'Heavy cream', calories: 340, protein_g: 2, fat_g: 36, weight_g: 100, is_beverage: true })!
    expect(cream.beverageCapped).toBe(false)
    expect(cream.score).toBeLessThanOrEqual(1.4)
  })

  it('returns null when unscoreable', () => {
    expect(fullnessExplain({ food_name: 'Mystery', calories: 0, protein_g: 0, fat_g: 0, weight_g: 100 })).toBeNull()
    expect(fullnessExplain({ food_name: 'No weight', calories: 100, protein_g: 5, fat_g: 2 })).toBeNull()
  })
})

describe('fullnessPercentile', () => {
  it('places a score within a cohort (ties count as half)', () => {
    expect(fullnessPercentile(5, [1, 2, 3, 4])).toBe(100)
    expect(fullnessPercentile(0, [1, 2, 3, 4])).toBe(0)
    expect(fullnessPercentile(2.5, [1, 2, 3, 4])).toBe(50)
    expect(fullnessPercentile(3, [1, 2, 3, 4])).toBe(63) // below=2, equal=1 → (2.5/4)
  })

  it('returns null for an empty cohort', () => {
    expect(fullnessPercentile(3, [])).toBeNull()
  })

  it('fullnessScores drops unscoreable foods', () => {
    const scores = fullnessScores([
      { food_name: 'Greek yogurt', calories: 120, protein_g: 20, fat_g: 0, weight_g: 200 },
      { food_name: 'No weight', calories: 100, protein_g: 5, fat_g: 2 }, // dropped
    ])
    expect(scores).toHaveLength(1)
  })
})

describe('fullnessBreakdown', () => {
  it('counts explicit drink weight as beverage volume', () => {
    const breakdown = fullnessBreakdown([
      {
        food_name: 'Coffee',
        calories: 5,
        protein_g: 0,
        fat_g: 0,
        weight_g: 240,
        is_beverage: true,
      },
      {
        food_name: 'Greek yogurt',
        calories: 120,
        protein_g: 20,
        fat_g: 0,
        weight_g: 200,
        is_beverage: false,
      },
    ])

    expect(breakdown.beverageWeightG).toBe(240)
    expect(breakdown.foodWeightG).toBe(200)
  })
})
