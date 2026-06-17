import { describe, expect, it } from 'vitest'
import { dayStayingPower, mealStayingPower } from './stayingPower'

describe('mealStayingPower', () => {
  it('scores a balanced full meal above an isolated watery vegetable serving', () => {
    const bowl = mealStayingPower([
      {
        food_name: 'Chicken bean bowl',
        calories: 720,
        protein_g: 42,
        carbs_g: 85,
        fat_g: 18,
        fiber_g: 13,
        weight_g: 650,
        is_beverage: false,
      },
    ])!
    const cucumber = mealStayingPower([
      {
        food_name: 'Cucumber',
        calories: 45,
        protein_g: 2,
        carbs_g: 9,
        fat_g: 0,
        fiber_g: 2,
        weight_g: 300,
        is_beverage: false,
      },
    ])!

    expect(bowl.tier).toBe('strong')
    expect(bowl.fillingPerCalorieScore).toBeGreaterThan(0)
    expect(cucumber.tier).toBe('light')
    expect(bowl.score).toBeGreaterThan(cucumber.score)
  })

  it('penalizes liquid calories separately from solid food volume', () => {
    const meal = mealStayingPower([
      {
        food_name: 'Sandwich',
        calories: 520,
        protein_g: 28,
        carbs_g: 58,
        fat_g: 16,
        fiber_g: 6,
        weight_g: 360,
        is_beverage: false,
      },
      {
        food_name: 'Soda',
        calories: 180,
        protein_g: 0,
        carbs_g: 45,
        fat_g: 0,
        fiber_g: 0,
        weight_g: 355,
        is_beverage: true,
      },
    ])!

    expect(meal.beverageCalories).toBe(180)
    expect(meal.beverageWeightG).toBe(355)
    expect(meal.beverageKcalPer100ml).toBeCloseTo(50.7, 1)
    expect(meal.foodWeightG).toBe(360)
    expect(meal.components.drinkPenalty).toBeGreaterThan(0)
  })

  it('keeps dense high-fat meals from looking equivalent to high-volume protein meals', () => {
    const soup = mealStayingPower([
      {
        food_name: 'Chicken lentil soup',
        calories: 520,
        protein_g: 38,
        carbs_g: 60,
        fat_g: 10,
        fiber_g: 15,
        weight_g: 700,
        is_beverage: false,
      },
    ])!
    const alfredo = mealStayingPower([
      {
        food_name: 'Pasta alfredo',
        calories: 650,
        protein_g: 20,
        carbs_g: 66,
        fat_g: 34,
        fiber_g: 3,
        weight_g: 250,
        is_beverage: false,
      },
    ])!

    expect(soup.tier).toBe('strong')
    expect(alfredo.tier).toBe('moderate')
    expect(soup.score).toBeGreaterThan(alfredo.score)
  })
})

describe('dayStayingPower', () => {
  it('summarizes meal counts and day-level drivers', () => {
    const meals = [
      mealStayingPower([
        { food_name: 'Greek yogurt', calories: 220, protein_g: 24, fat_g: 2, fiber_g: 4, weight_g: 250 },
      ])!,
      mealStayingPower([
        { food_name: 'Burrito bowl', calories: 720, protein_g: 42, fat_g: 18, fiber_g: 13, weight_g: 650 },
      ])!,
    ]

    const day = dayStayingPower(meals)

    expect(day.totalMeals).toBe(2)
    expect(day.byTier.strong).toBeGreaterThanOrEqual(1)
    expect(day.foodWeightG).toBe(900)
    expect(day.protein_g).toBe(66)
    expect(day.fiber_g).toBe(17)
  })
})
