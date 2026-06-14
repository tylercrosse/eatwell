import { ATWATER } from './targets'
import { round } from './totals'

export type MacroKey = 'protein' | 'fat' | 'carbs'
export type NutrientKey = MacroKey | 'fiber'

export interface NutritionInput {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number | null
}

export interface NutritionDisplay {
  key: NutrientKey
  label: string
  field: keyof NutritionInput
  colorVar: string
}

export const MACRO_ORDER: readonly MacroKey[] = ['protein', 'fat', 'carbs']
export const NUTRIENT_ORDER: readonly NutrientKey[] = ['protein', 'fat', 'carbs', 'fiber']

export const NUTRITION_DISPLAY: Record<NutrientKey, NutritionDisplay> = {
  protein: { key: 'protein', label: 'Protein', field: 'protein_g', colorVar: '--macro-protein' },
  fat: { key: 'fat', label: 'Fat', field: 'fat_g', colorVar: '--macro-fat' },
  carbs: { key: 'carbs', label: 'Carbs', field: 'carbs_g', colorVar: '--macro-carbs' },
  fiber: { key: 'fiber', label: 'Fiber', field: 'fiber_g', colorVar: '--macro-fiber' },
}

export const cssVar = (name: string) => `var(${name})`

export function nutrientGrams(food: NutritionInput, key: NutrientKey): number {
  return Number(food[NUTRITION_DISPLAY[key].field] ?? 0)
}

export function macroCalories(food: NutritionInput, key: MacroKey): number {
  const grams = Math.max(0, nutrientGrams(food, key))
  if (key === 'fat') return grams * ATWATER.fat
  if (key === 'protein') return grams * ATWATER.protein
  return grams * ATWATER.carbs
}

export function nutritionLegendItems(food: NutritionInput) {
  return NUTRIENT_ORDER.map((key) => {
    const display = NUTRITION_DISPLAY[key]
    const grams = nutrientGrams(food, key)
    if (key === 'fiber' && grams <= 0) return null
    return {
      key,
      label: display.label,
      value: `${round(grams)}g`,
      colorVar: display.colorVar,
    }
  }).filter((item): item is { key: NutrientKey; label: string; value: string; colorVar: string } => item != null)
}
