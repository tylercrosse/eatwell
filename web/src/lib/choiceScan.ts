import { fullnessFactor, isBeverageForFullness, type Fullness } from './fullness'
import type { GoalDirection } from './targets'
import { round } from './totals'
import type { MenuAnalysisResult, MenuOption } from '../types'

export type ChoiceGoal = GoalDirection | 'unknown'
export type ChoiceSort = 'recommended' | 'menu' | 'calories' | 'protein' | 'fullness'

export interface FoodChoice {
  id: string
  name: string
  menuOrder?: number
  description?: string
  section?: string
  price?: string
  sourceText?: string
  servingSize?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
  is_beverage?: boolean | null
  confidence?: number | null
}

export interface ScoredFoodChoice {
  choice: FoodChoice
  fullness: Fullness
  choiceScore: number
  proteinPer100Kcal: number
  fiberPer100Kcal: number
  reason: string
}

export interface ChoiceConfidenceCopy {
  label: string
  tone: 'high' | 'medium' | 'low'
}

const safeNumber = (v: number | null | undefined) => (Number.isFinite(v) ? Math.max(0, v ?? 0) : 0)

const per100Kcal = (grams: number | null | undefined, calories: number) =>
  calories > 0 ? (safeNumber(grams) / calories) * 100 : 0

export function choiceFromMenuOption(option: MenuOption, index: number): FoodChoice {
  return {
    id: `${index}-${option.name}`,
    name: option.name,
    menuOrder: index,
    description: option.description,
    section: option.section,
    price: option.price,
    sourceText: option.source_text,
    servingSize: option.serving_size_estimate,
    calories: option.calories,
    protein_g: option.protein_g,
    carbs_g: option.carbs_g,
    fat_g: option.fat_g,
    weight_g: option.weight_g,
    fiber_g: option.fiber_g,
    sugar_g: option.sugar_g,
    sodium_mg: option.sodium_mg,
    is_beverage: option.is_beverage,
    confidence: option.confidence,
  }
}

export function choicesFromMenuResult(result: MenuAnalysisResult): FoodChoice[] {
  return result.options.map(choiceFromMenuOption)
}

function scoreChoice(choice: FoodChoice, fullness: Fullness, goal: ChoiceGoal): number {
  const calories = safeNumber(choice.calories)
  const protein = safeNumber(choice.protein_g)
  const proteinDensity = per100Kcal(choice.protein_g, calories)
  const fiberDensity = per100Kcal(choice.fiber_g, calories)
  const beveragePenalty = isBeverageForFullness(choice) ? 10 : 0
  const lowFullnessPenalty = fullness.tier === 'low' ? 8 : fullness.tier === 'light' ? 3 : 0

  if (goal === 'lose') {
    return fullness.score * 22 + proteinDensity * 1.8 + fiberDensity * 1.5 - calories / 120 - beveragePenalty
  }
  if (goal === 'gain') {
    return fullness.score * 12 + protein * 0.9 + proteinDensity * 0.8 + fiberDensity * 0.5 + calories / 120 - lowFullnessPenalty
  }
  return fullness.score * 18 + proteinDensity * 1.2 + fiberDensity - calories / 260 - beveragePenalty
}

function reasonFor(choice: FoodChoice, fullness: Fullness, goal: ChoiceGoal): string {
  const calories = safeNumber(choice.calories)
  const protein = safeNumber(choice.protein_g)
  const proteinDensity = per100Kcal(choice.protein_g, calories)
  const fiberDensity = per100Kcal(choice.fiber_g, calories)

  if (isBeverageForFullness(choice)) return 'Liquid calories are capped low for fullness.'
  if (goal === 'gain' && calories >= 550 && protein >= 25) return 'Useful protein and calories for a gain phase.'
  if (goal === 'gain' && fullness.score >= 3) return 'Filling enough to anchor a meal; add denser sides if calories are short.'
  if (fullness.score >= 4) return 'High volume for the calories.'
  if (proteinDensity >= 8) return 'Strong protein per calorie.'
  if (fiberDensity >= 3) return 'Useful fiber for appetite control.'
  return 'Better fullness than many calorie-dense choices.'
}

export function rankFoodChoices(choices: FoodChoice[], goal: ChoiceGoal): ScoredFoodChoice[] {
  const scored = choices.flatMap((choice) => {
    const fullness = fullnessFactor(choice)
    if (!fullness) return []
    const calories = safeNumber(choice.calories)
    return [
      {
        choice,
        fullness,
        choiceScore: scoreChoice(choice, fullness, goal),
        proteinPer100Kcal: per100Kcal(choice.protein_g, calories),
        fiberPer100Kcal: per100Kcal(choice.fiber_g, calories),
        reason: reasonFor(choice, fullness, goal),
      },
    ]
  })

  return sortScoredFoodChoices(scored, 'recommended')
}

export function sortScoredFoodChoices(items: ScoredFoodChoice[], sort: ChoiceSort): ScoredFoodChoice[] {
  const byName = (a: ScoredFoodChoice, b: ScoredFoodChoice) => a.choice.name.localeCompare(b.choice.name)
  const byMenuOrder = (a: ScoredFoodChoice, b: ScoredFoodChoice) =>
    (a.choice.menuOrder ?? Number.MAX_SAFE_INTEGER) - (b.choice.menuOrder ?? Number.MAX_SAFE_INTEGER) || byName(a, b)

  if (sort === 'menu') {
    return [...items].sort(byMenuOrder)
  }
  if (sort === 'calories') {
    return [...items].sort((a, b) => safeNumber(a.choice.calories) - safeNumber(b.choice.calories) || byMenuOrder(a, b))
  }
  if (sort === 'protein') {
    return [...items].sort((a, b) => safeNumber(b.choice.protein_g) - safeNumber(a.choice.protein_g) || byMenuOrder(a, b))
  }
  if (sort === 'fullness') {
    return [...items].sort((a, b) => b.fullness.score - a.fullness.score || byMenuOrder(a, b))
  }

  return [...items].sort(
    (a, b) => b.choiceScore - a.choiceScore || b.fullness.score - a.fullness.score || byMenuOrder(a, b),
  )
}

export function foodChoiceMeta(choice: FoodChoice): string {
  const serving = choice.servingSize?.trim() || 'estimated serving'
  const parts = [
    serving,
    `${round(safeNumber(choice.calories))} kcal`,
    `${round(safeNumber(choice.protein_g))} g protein`,
  ]
  if (choice.fiber_g && choice.fiber_g > 0) parts.push(`${round(choice.fiber_g)} g fiber`)
  return parts.join(' · ')
}

export function foodChoiceSectionLabel(choice: FoodChoice): string | null {
  return choice.section?.trim() || null
}

export function foodChoiceLocationMeta(choice: FoodChoice): string {
  const position = typeof choice.menuOrder === 'number' ? `Menu #${choice.menuOrder + 1}` : ''
  const price = choice.price?.trim() || ''
  return [position, price].filter(Boolean).join(' · ')
}

export function choiceConfidenceCopy(confidence: number | null | undefined): ChoiceConfidenceCopy | null {
  if (confidence == null) return null
  if (confidence >= 0.66) return { label: 'High confidence', tone: 'high' }
  if (confidence >= 0.45) return { label: 'Medium confidence', tone: 'medium' }
  return { label: 'Low confidence', tone: 'low' }
}
