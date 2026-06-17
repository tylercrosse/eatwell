import { fullnessFactor, isBeverageForFullness, type FullnessInput } from './fullness'

export type StayingPowerTier = 'strong' | 'solid' | 'moderate' | 'light'

export interface StayingPowerInput extends FullnessInput {
  carbs_g?: number | null
}

export interface StayingPowerComponents {
  portion: number
  protein: number
  fiber: number
  calories: number
  densityPenalty: number
  drinkPenalty: number
  fatPenalty: number
}

export interface MealStayingPower {
  score: number
  tier: StayingPowerTier
  calories: number
  protein_g: number
  fat_g: number
  fiber_g: number
  foodWeightG: number
  beverageWeightG: number
  beverageCalories: number
  beverageKcalPer100ml: number | null
  unknownFoodCalories: number
  kcalPer100g: number | null
  fillingPerCalorieScore: number | null
  components: StayingPowerComponents
}

export interface DayStayingPower {
  meals: MealStayingPower[]
  byTier: Record<StayingPowerTier, number>
  totalMeals: number
  calories: number
  protein_g: number
  fiber_g: number
  foodWeightG: number
  beverageWeightG: number
}

export const STAYING_POWER_TIERS: StayingPowerTier[] = ['strong', 'solid', 'moderate', 'light']

export const STAYING_POWER_LABELS: Record<StayingPowerTier, string> = {
  strong: 'Strong',
  solid: 'Solid',
  moderate: 'Moderate',
  light: 'Light',
}

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v))
const safe = (v: number | null | undefined) => (Number.isFinite(v) ? Math.max(0, v ?? 0) : 0)
const saturate = (v: number) => 1 - Math.exp(-Math.max(0, v))

export function stayingPowerTier(score: number): StayingPowerTier {
  if (score >= 2.65) return 'strong'
  if (score >= 1.9) return 'solid'
  if (score >= 1.1) return 'moderate'
  return 'light'
}

/**
 * Portion-based meal staying power. Unlike Fullness Factor, this describes the actual logged
 * serving: total food mass, protein, fiber, and enough energy to behave like a meal.
 */
export function mealStayingPower(items: StayingPowerInput[]): MealStayingPower | null {
  let calories = 0
  let protein_g = 0
  let fat_g = 0
  let fiber_g = 0
  let foodWeightG = 0
  let beverageWeightG = 0
  let beverageCalories = 0
  let solidCaloriesWithWeight = 0
  let unknownFoodCalories = 0
  let fillingPerCalorieCalSum = 0
  let fillingPerCalorieScoredCal = 0

  for (const item of items) {
    const itemCalories = safe(item.calories)
    const itemWeight = safe(item.weight_g)
    calories += itemCalories
    protein_g += safe(item.protein_g)
    fat_g += safe(item.fat_g)
    fiber_g += safe(item.fiber_g)

    if (isBeverageForFullness(item)) {
      beverageCalories += itemCalories
      beverageWeightG += itemWeight
    } else if (itemWeight > 0) {
      foodWeightG += itemWeight
      solidCaloriesWithWeight += itemCalories
    } else {
      unknownFoodCalories += itemCalories
    }

    const perCalorie = fullnessFactor(item)
    if (perCalorie) {
      fillingPerCalorieCalSum += perCalorie.score * itemCalories
      fillingPerCalorieScoredCal += itemCalories
    }
  }

  if (calories <= 0) return null

  const kcalPer100g = foodWeightG > 0 ? (solidCaloriesWithWeight / foodWeightG) * 100 : null
  const beverageKcalPer100ml = beverageWeightG > 0 ? (beverageCalories / beverageWeightG) * 100 : null
  const fatKcalShare = calories > 0 ? (fat_g * 9) / calories : 0
  const fillingPerCalorieScore =
    fillingPerCalorieScoredCal > 0 ? fillingPerCalorieCalSum / fillingPerCalorieScoredCal : null
  const components: StayingPowerComponents = {
    portion: 1.25 * saturate(foodWeightG / 420),
    protein: 1.15 * saturate(protein_g / 35),
    fiber: 0.85 * saturate(fiber_g / 11),
    calories: 0.75 * saturate(calories / 650),
    densityPenalty: kcalPer100g == null ? 0 : 0.75 * saturate((kcalPer100g - 180) / 220),
    drinkPenalty: 0.65 * saturate(beverageCalories / 200),
    fatPenalty: 0.35 * saturate((fatKcalShare - 0.4) / 0.25),
  }
  const score = clamp(
    0,
    4,
    components.portion +
      components.protein +
      components.fiber +
      components.calories -
      components.densityPenalty -
      components.drinkPenalty -
      components.fatPenalty,
  )

  return {
    score,
    tier: stayingPowerTier(score),
    calories,
    protein_g,
    fat_g,
    fiber_g,
    foodWeightG,
    beverageWeightG,
    beverageCalories,
    beverageKcalPer100ml,
    unknownFoodCalories,
    kcalPer100g,
    fillingPerCalorieScore,
    components,
  }
}

export function dayStayingPower(meals: MealStayingPower[]): DayStayingPower {
  const byTier: Record<StayingPowerTier, number> = {
    strong: 0,
    solid: 0,
    moderate: 0,
    light: 0,
  }
  let calories = 0
  let protein_g = 0
  let fiber_g = 0
  let foodWeightG = 0
  let beverageWeightG = 0

  for (const meal of meals) {
    byTier[meal.tier] += 1
    calories += meal.calories
    protein_g += meal.protein_g
    fiber_g += meal.fiber_g
    foodWeightG += meal.foodWeightG
    beverageWeightG += meal.beverageWeightG
  }

  return {
    meals,
    byTier,
    totalMeals: meals.length,
    calories,
    protein_g,
    fiber_g,
    foodWeightG,
    beverageWeightG,
  }
}
