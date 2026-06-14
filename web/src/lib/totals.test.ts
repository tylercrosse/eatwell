import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { sumTotals } from './totals'

const entry = (patch: Partial<Entry>): Entry =>
  ({
    calories: patch.calories ?? 0,
    protein_g: patch.protein_g ?? 0,
    carbs_g: patch.carbs_g ?? 0,
    fiber_g: patch.fiber_g ?? null,
    fat_g: patch.fat_g ?? 0,
  }) as Entry

describe('sumTotals', () => {
  it('sums fiber while treating missing fiber as zero', () => {
    expect(
      sumTotals([
        entry({ calories: 100, protein_g: 5, carbs_g: 20, fiber_g: 4, fat_g: 2 }),
        entry({ calories: 50, protein_g: 2, carbs_g: 10, fiber_g: null, fat_g: 1 }),
      ]),
    ).toEqual({ calories: 150, protein_g: 7, carbs_g: 30, fiber_g: 4, fat_g: 3 })
  })
})
