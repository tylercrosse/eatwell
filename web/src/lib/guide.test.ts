import { describe, expect, it } from 'vitest'
import {
  FILLING_FOOD_IDEAS,
  LESS_FILLING_PATTERNS,
  guideFoodMeta,
  guideGoalCopy,
  rankGuideFoods,
  type GuideGoal,
} from './guide'
import type { RecentFood } from '../types'

const food = (patch: Partial<RecentFood> & Pick<RecentFood, 'food_name'>): RecentFood => ({
  food_name: patch.food_name,
  calories: patch.calories ?? 200,
  protein_g: patch.protein_g ?? 10,
  carbs_g: patch.carbs_g ?? 20,
  fat_g: patch.fat_g ?? 5,
  weight_g: 'weight_g' in patch ? patch.weight_g : 200,
  fiber_g: 'fiber_g' in patch ? patch.fiber_g : 2,
  sugar_g: 'sugar_g' in patch ? patch.sugar_g : 0,
  sodium_mg: 'sodium_mg' in patch ? patch.sodium_mg : 0,
  is_beverage: patch.is_beverage ?? false,
  serving_size: patch.serving_size ?? null,
  times_logged: patch.times_logged ?? null,
})

describe('rankGuideFoods', () => {
  it('excludes foods without usable weight', () => {
    const ranked = rankGuideFoods(
      [
        food({ food_name: 'Unknown bowl', weight_g: null }),
        food({ food_name: 'Greek yogurt', calories: 120, protein_g: 20, weight_g: 200 }),
      ],
      'lose',
    )

    expect(ranked.map((f) => f.food.food_name)).toEqual(['Greek yogurt'])
  })

  it('puts higher-fullness protein foods above low-fullness foods for loss framing', () => {
    const ranked = rankGuideFoods(
      [
        food({ food_name: 'Almonds', calories: 170, protein_g: 6, fat_g: 15, fiber_g: 3, weight_g: 28 }),
        food({ food_name: 'Chicken breast', calories: 165, protein_g: 31, fat_g: 4, fiber_g: 0, weight_g: 100 }),
      ],
      'lose',
    )

    expect(ranked[0].food.food_name).toBe('Chicken breast')
    expect(ranked[0].fullness.score).toBeGreaterThan(ranked[1].fullness.score)
  })
})

describe('guideGoalCopy', () => {
  it.each<GuideGoal>(['lose', 'gain', 'maintain', 'unknown'])('returns goal-aware copy for %s', (goal) => {
    const copy = guideGoalCopy(goal)

    expect(copy.label).toBeTruthy()
    expect(copy.title).toBeTruthy()
    expect(copy.body).toBeTruthy()
  })

  it('preserves distinct labels for each goal state', () => {
    expect(guideGoalCopy('lose').label).toBe('Loss')
    expect(guideGoalCopy('gain').label).toBe('Gain')
    expect(guideGoalCopy('maintain').label).toBe('Maintain')
    expect(guideGoalCopy('unknown').label).toBe('Guide')
  })
})

describe('guideFoodMeta', () => {
  it('shows the logged serving context before nutrition', () => {
    expect(
      guideFoodMeta(
        food({
          food_name: 'Greek yogurt',
          calories: 120,
          protein_g: 20,
          fiber_g: 1,
          serving_size: '1 cup (200g)',
          times_logged: 4,
        }),
      ),
    ).toBe('1 cup (200g) · 120 kcal · 20 g protein · 1 g fiber · 4x logged')
  })

  it('falls back when a serving label is missing', () => {
    expect(guideFoodMeta(food({ food_name: 'Chicken breast', serving_size: null }))).toContain('logged serving')
  })
})

describe('static guide data', () => {
  it('keeps meal-builder groups compact and annotated', () => {
    const roleTones = new Set(['anchor', 'volume', 'fiber', 'addon'])

    expect(FILLING_FOOD_IDEAS.length).toBeLessThanOrEqual(4)
    for (const group of FILLING_FOOD_IDEAS) {
      expect(group.title).toBeTruthy()
      expect(group.body).toBeTruthy()
      expect(roleTones.has(group.badge.tone)).toBe(true)
      expect(group.examples.length).toBeGreaterThanOrEqual(6)
      for (const example of group.examples) {
        expect(example.name).toBeTruthy()
        expect(example.detail).toBeTruthy()
      }
    }
  })

  it('labels less-filling rows with a standard fullness badge', () => {
    const tones = new Set(['very-filling', 'filling', 'moderate', 'light', 'low'])
    for (const row of LESS_FILLING_PATTERNS) {
      expect(row.badge.label).toBeTruthy()
      expect(tones.has(row.badge.tone)).toBe(true)
    }
  })
})
