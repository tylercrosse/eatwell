import { isBeverageForFullness } from './fullness'
import { mealStayingPower, STAYING_POWER_LABELS, type MealStayingPower } from './stayingPower'
import type { GoalDirection } from './targets'
import { round } from './totals'
import type { MenuAnalysisResult, MenuOption } from '../types'

export type ChoiceGoal = GoalDirection | 'unknown'
export type ChoiceSort = 'recommended' | 'menu' | 'calories' | 'protein' | 'fiber' | 'stayingPower'

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
  stayingPower: MealStayingPower
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

function scoreChoice(choice: FoodChoice, stayingPower: MealStayingPower, goal: ChoiceGoal): number {
  const calories = safeNumber(choice.calories)
  const protein = safeNumber(choice.protein_g)
  const proteinDensity = per100Kcal(choice.protein_g, calories)
  const fiberDensity = per100Kcal(choice.fiber_g, calories)
  const beveragePenalty = isBeverageForFullness(choice) ? 10 : 0
  const lowSupportPenalty = stayingPower.tier === 'light' ? 8 : stayingPower.tier === 'moderate' ? 2 : 0

  if (goal === 'lose') {
    return stayingPower.score * 24 + proteinDensity * 1.8 + fiberDensity * 1.5 - calories / 160 - beveragePenalty
  }
  if (goal === 'gain') {
    return stayingPower.score * 14 + protein * 0.9 + proteinDensity * 0.8 + fiberDensity * 0.5 + calories / 130 - lowSupportPenalty
  }
  return stayingPower.score * 20 + proteinDensity * 1.2 + fiberDensity - calories / 260 - beveragePenalty
}

function reasonFor(choice: FoodChoice, stayingPower: MealStayingPower, goal: ChoiceGoal): string {
  const calories = safeNumber(choice.calories)
  const protein = safeNumber(choice.protein_g)
  const proteinDensity = per100Kcal(choice.protein_g, calories)
  const fiberDensity = per100Kcal(choice.fiber_g, calories)

  if (isBeverageForFullness(choice)) return 'Liquid calories count separately because drinks usually have less staying power.'
  if (goal === 'gain' && calories >= 550 && protein >= 25) return 'Useful protein and calories for a gain phase.'
  if (goal === 'gain' && stayingPower.tier === 'strong') return 'Strong enough to anchor a meal; add denser sides if calories are short.'
  if (stayingPower.tier === 'strong' && stayingPower.foodWeightG >= 400) return 'Strong logged portion with useful food volume.'
  if (proteinDensity >= 8) return 'Strong protein per calorie.'
  if (fiberDensity >= 3) return 'Useful fiber for appetite control.'
  if (stayingPower.unknownFoodCalories > 0) return 'Nutrition suggests support, but missing food weight makes volume uncertain.'
  return `${STAYING_POWER_LABELS[stayingPower.tier]} staying power for this logged portion.`
}

export function rankFoodChoices(choices: FoodChoice[], goal: ChoiceGoal): ScoredFoodChoice[] {
  const scored = choices.flatMap((choice) => {
    const stayingPower = mealStayingPower([choice])
    if (!stayingPower) return []
    const calories = safeNumber(choice.calories)
    return [
      {
        choice,
        stayingPower,
        choiceScore: scoreChoice(choice, stayingPower, goal),
        proteinPer100Kcal: per100Kcal(choice.protein_g, calories),
        fiberPer100Kcal: per100Kcal(choice.fiber_g, calories),
        reason: reasonFor(choice, stayingPower, goal),
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
  if (sort === 'fiber') {
    return [...items].sort((a, b) => safeNumber(b.choice.fiber_g) - safeNumber(a.choice.fiber_g) || byMenuOrder(a, b))
  }
  if (sort === 'stayingPower') {
    return [...items].sort((a, b) => b.stayingPower.score - a.stayingPower.score || byMenuOrder(a, b))
  }

  return [...items].sort(
    (a, b) => b.choiceScore - a.choiceScore || b.stayingPower.score - a.stayingPower.score || byMenuOrder(a, b),
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
