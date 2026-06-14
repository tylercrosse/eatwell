import { describe, expect, it } from 'vitest'
import {
  choiceConfidenceCopy,
  choiceFromMenuOption,
  choicesFromMenuResult,
  foodChoiceLocationMeta,
  rankFoodChoices,
  sortScoredFoodChoices,
  type FoodChoice,
} from './choiceScan'
import type { MenuOption } from '../types'

const menuOption = (patch: Partial<MenuOption> & Pick<MenuOption, 'name'>): MenuOption => ({
  name: patch.name,
  description: patch.description ?? '',
  section: patch.section ?? '',
  price: patch.price ?? '',
  source_text: patch.source_text ?? patch.name,
  calories: patch.calories ?? 400,
  protein_g: patch.protein_g ?? 20,
  carbs_g: patch.carbs_g ?? 35,
  fat_g: patch.fat_g ?? 14,
  weight_g: patch.weight_g ?? 350,
  fiber_g: patch.fiber_g ?? 4,
  sugar_g: patch.sugar_g ?? 6,
  sodium_mg: patch.sodium_mg ?? 700,
  is_beverage: patch.is_beverage ?? false,
  serving_size_estimate: patch.serving_size_estimate ?? '1 serving (~350g)',
  confidence: patch.confidence ?? 0.7,
})

const choice = (patch: Partial<FoodChoice> & Pick<FoodChoice, 'name'>): FoodChoice => ({
  id: patch.id ?? patch.name,
  name: patch.name,
  menuOrder: patch.menuOrder,
  section: patch.section,
  price: patch.price,
  calories: patch.calories ?? 400,
  protein_g: patch.protein_g ?? 20,
  carbs_g: patch.carbs_g ?? 35,
  fat_g: patch.fat_g ?? 14,
  weight_g: patch.weight_g ?? 350,
  fiber_g: patch.fiber_g ?? 4,
  sugar_g: patch.sugar_g ?? 6,
  sodium_mg: patch.sodium_mg ?? 700,
  is_beverage: patch.is_beverage ?? false,
  confidence: patch.confidence ?? 0.7,
})

describe('menu choice mapping', () => {
  it('maps backend menu options into shared food choices', () => {
    const option = menuOption({
      name: 'Turkey sandwich',
      section: 'Lunch',
      price: '$12',
      source_text: 'Turkey sandwich $12',
    })

    const mapped = choiceFromMenuOption(option, 2)

    expect(mapped.id).toBe('2-Turkey sandwich')
    expect(mapped.name).toBe('Turkey sandwich')
    expect(mapped.menuOrder).toBe(2)
    expect(mapped.section).toBe('Lunch')
    expect(mapped.price).toBe('$12')
    expect(mapped.sourceText).toBe('Turkey sandwich $12')
  })

  it('maps an entire menu result', () => {
    const choices = choicesFromMenuResult({
      restaurant_name: 'Cafe',
      confidence: 0.8,
      options: [menuOption({ name: 'Salad' }), menuOption({ name: 'Soup' })],
    })

    expect(choices.map((c) => c.name)).toEqual(['Salad', 'Soup'])
  })
})

describe('food choice display metadata', () => {
  it('shows original menu position and price separately from recommendation rank', () => {
    expect(foodChoiceLocationMeta(choice({ name: 'Turkey sandwich', menuOrder: 4, price: '$12' }))).toBe(
      'Menu #5 · $12',
    )
  })

  it('falls back to price when menu order is unavailable', () => {
    expect(foodChoiceLocationMeta(choice({ name: 'Soup', price: '$9' }))).toBe('$9')
  })
})

describe('rankFoodChoices', () => {
  it('favors filling, protein-rich options for loss goals', () => {
    const ranked = rankFoodChoices(
      [
        choice({ name: 'Fries', calories: 520, protein_g: 6, fat_g: 28, weight_g: 180, fiber_g: 4 }),
        choice({ name: 'Grilled chicken salad', calories: 420, protein_g: 38, fat_g: 16, weight_g: 420, fiber_g: 7 }),
      ],
      'lose',
    )

    expect(ranked[0].choice.name).toBe('Grilled chicken salad')
  })

  it('ranks drinks low when comparing for loss', () => {
    const ranked = rankFoodChoices(
      [
        choice({ name: 'Orange juice', calories: 180, protein_g: 2, fat_g: 0, weight_g: 355, is_beverage: true }),
        choice({ name: 'Chicken soup', calories: 260, protein_g: 24, fat_g: 8, weight_g: 420, fiber_g: 4 }),
      ],
      'lose',
    )

    expect(ranked[0].choice.name).toBe('Chicken soup')
    expect(ranked[1].fullness.tier).toBe('low')
  })
})

describe('sortScoredFoodChoices', () => {
  it('can restore detected menu order', () => {
    const scored = rankFoodChoices(
      [
        choice({ name: 'Fries', menuOrder: 0, calories: 520, protein_g: 6, fat_g: 28, weight_g: 180, fiber_g: 4 }),
        choice({
          name: 'Grilled chicken salad',
          menuOrder: 1,
          calories: 420,
          protein_g: 38,
          fat_g: 16,
          weight_g: 420,
          fiber_g: 7,
        }),
      ],
      'lose',
    )

    expect(scored[0].choice.name).toBe('Grilled chicken salad')
    expect(sortScoredFoodChoices(scored, 'menu').map((item) => item.choice.name)).toEqual([
      'Fries',
      'Grilled chicken salad',
    ])
  })

  it('sorts calories low first', () => {
    const sorted = sortScoredFoodChoices(
      rankFoodChoices(
        [
          choice({ name: 'Burrito', menuOrder: 0, calories: 760, protein_g: 32, weight_g: 430 }),
          choice({ name: 'Chicken soup', menuOrder: 1, calories: 260, protein_g: 24, weight_g: 420, fiber_g: 4 }),
        ],
        'maintain',
      ),
      'calories',
    )

    expect(sorted.map((item) => item.choice.name)).toEqual(['Chicken soup', 'Burrito'])
  })

  it('sorts protein high first', () => {
    const sorted = sortScoredFoodChoices(
      rankFoodChoices(
        [
          choice({ name: 'Pasta', menuOrder: 0, calories: 620, protein_g: 18, weight_g: 360 }),
          choice({ name: 'Steak plate', menuOrder: 1, calories: 720, protein_g: 54, weight_g: 430 }),
        ],
        'gain',
      ),
      'protein',
    )

    expect(sorted.map((item) => item.choice.name)).toEqual(['Steak plate', 'Pasta'])
  })

  it('sorts fullness high first', () => {
    const sorted = sortScoredFoodChoices(
      rankFoodChoices(
        [
          choice({ name: 'Mozzarella sticks', menuOrder: 0, calories: 610, protein_g: 20, fat_g: 42, weight_g: 210 }),
          choice({ name: 'Lentil soup', menuOrder: 1, calories: 330, protein_g: 22, fat_g: 7, weight_g: 500, fiber_g: 12 }),
        ],
        'unknown',
      ),
      'fullness',
    )

    expect(sorted.map((item) => item.choice.name)).toEqual(['Lentil soup', 'Mozzarella sticks'])
  })
})

describe('choiceConfidenceCopy', () => {
  it('labels low-confidence estimates for UI display', () => {
    expect(choiceConfidenceCopy(0.3)?.label).toBe('Low confidence')
    expect(choiceConfidenceCopy(0.5)?.label).toBe('Medium confidence')
    expect(choiceConfidenceCopy(0.8)?.label).toBe('High confidence')
  })
})
