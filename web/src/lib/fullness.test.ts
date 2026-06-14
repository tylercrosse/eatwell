import { describe, expect, it } from 'vitest'
import { fullnessBreakdown, fullnessFactor, isBeverageForFullness } from './fullness'

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
