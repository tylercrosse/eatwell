import { describe, expect, it } from 'vitest'
import { balanceColor, projectedBalanceKcal, BALANCE_RED_KCAL } from './energy'

describe('projectedBalanceKcal', () => {
  it('assumes eating up to the target when intake is still below it', () => {
    // Mid-day: 800 eaten of a 2100 target, 3000 full-day burn → project 2100 − 3000, not 800 − 3000.
    expect(projectedBalanceKcal({ consumed: 800, calorieTarget: 2100, burnedTotal: 3000 })).toBe(-900)
  })

  it('uses actual intake once it passes the target', () => {
    expect(projectedBalanceKcal({ consumed: 2600, calorieTarget: 2100, burnedTotal: 3000 })).toBe(-400)
  })
})

describe('balanceColor', () => {
  const hue = (color: string | null): number => {
    const m = /^hsl\((-?\d+),/.exec(color ?? '')
    if (!m) throw new Error(`not an hsl color: ${color}`)
    return Number(m[1])
  }

  it('is null with no goal to measure against', () => {
    expect(balanceColor(null)).toBeNull()
  })

  it('is green on the goal balance', () => {
    expect(hue(balanceColor(0))).toBe(150)
  })

  it('ramps green → red above plan (over-eating direction)', () => {
    expect(hue(balanceColor(BALANCE_RED_KCAL / 2))).toBe(75)
    expect(hue(balanceColor(BALANCE_RED_KCAL))).toBe(0)
  })

  it('ramps green → blue below plan (steeper-deficit direction)', () => {
    expect(hue(balanceColor(-BALANCE_RED_KCAL / 2))).toBe(183)
    expect(hue(balanceColor(-BALANCE_RED_KCAL))).toBe(215)
  })

  it('saturates beyond the red distance in both directions', () => {
    expect(balanceColor(BALANCE_RED_KCAL * 3)).toBe(balanceColor(BALANCE_RED_KCAL))
    expect(balanceColor(-BALANCE_RED_KCAL * 3)).toBe(balanceColor(-BALANCE_RED_KCAL))
  })
})
