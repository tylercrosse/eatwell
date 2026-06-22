import type { Meal } from '../types'
import type { IconAsset } from './iconAssets'
import crescentMoonFlatSvg from '../assets/food-icons/fluent/crescent_moon_flat.svg'
import popcornFlatSvg from '../assets/food-icons/fluent/popcorn_flat.svg'
import sunFlatSvg from '../assets/food-icons/fluent/sun_flat.svg'
import sunriseFlatSvg from '../assets/food-icons/fluent/sunrise_flat.svg'

const MEAL_ICONS: Record<Meal, IconAsset> = {
  breakfast: { src: sunriseFlatSvg, label: 'Sunrise' },
  lunch: { src: sunFlatSvg, label: 'Sun' },
  dinner: { src: crescentMoonFlatSvg, label: 'Crescent moon' },
  snacks: { src: popcornFlatSvg, label: 'Popcorn' },
}

export function mealIconFor(meal: Meal): IconAsset {
  return MEAL_ICONS[meal]
}
