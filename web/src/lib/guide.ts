import { type Fullness, type FullnessTier } from './fullness'
import { foodChoiceMeta, rankFoodChoices, type FoodChoice } from './choiceScan'
import type { GoalDirection } from './targets'
import type { RecentFood } from '../types'

export type GuideGoal = GoalDirection | 'unknown'
export type GuideStaticBadgeTone = FullnessTier
export type GuideRoleBadgeTone = 'anchor' | 'volume' | 'fiber' | 'addon'

export interface RankedGuideFood {
  food: RecentFood
  fullness: Fullness
  guideScore: number
  proteinPer100Kcal: number
  fiberPer100Kcal: number
  reason: string
}

export interface GuideGoalCopy {
  label: string
  title: string
  body: string
  note?: string
}

export interface GuideStaticBadge {
  label: string
  tone: GuideStaticBadgeTone
}

export interface GuideRoleBadge {
  label: string
  tone: GuideRoleBadgeTone
}

export interface GuideExample {
  name: string
  detail: string
}

export interface GuideExampleGroup {
  title: string
  badge: GuideRoleBadge
  body: string
  examples: GuideExample[]
}

export interface LessFillingPattern {
  title: string
  badge: GuideStaticBadge
  body: string
}

const safeNumber = (v: number | null | undefined) => (Number.isFinite(v) ? Math.max(0, v ?? 0) : 0)

export function guideFoodMeta(food: RecentFood): string {
  const parts = [foodChoiceMeta(choiceFromRecentFood(food)).replace('estimated serving', 'logged serving')]
  if (food.times_logged && food.times_logged > 1) parts.push(`${food.times_logged}x logged`)
  return parts.join(' · ')
}

function choiceFromRecentFood(food: RecentFood): FoodChoice {
  return {
    id: food.food_name,
    name: food.food_name,
    servingSize: food.serving_size ?? undefined,
    calories: safeNumber(food.calories),
    protein_g: safeNumber(food.protein_g),
    carbs_g: safeNumber(food.carbs_g),
    fat_g: safeNumber(food.fat_g),
    weight_g: food.weight_g,
    fiber_g: food.fiber_g,
    sugar_g: food.sugar_g,
    sodium_mg: food.sodium_mg,
    is_beverage: food.is_beverage,
  }
}

export function rankGuideFoods(foods: RecentFood[], goal: GuideGoal): RankedGuideFood[] {
  const byId = new Map<string, RecentFood>()
  const choices = foods.map((food) => {
    const choice = choiceFromRecentFood(food)
    byId.set(choice.id, food)
    return choice
  })
  return rankFoodChoices(choices, goal).map((scored) => ({
    food: byId.get(scored.choice.id)!,
    fullness: scored.fullness,
    guideScore: scored.choiceScore,
    proteinPer100Kcal: scored.proteinPer100Kcal,
    fiberPer100Kcal: scored.fiberPer100Kcal,
    reason: scored.reason,
  }))
}

export function guideGoalCopy(goal: GuideGoal): GuideGoalCopy {
  switch (goal) {
    case 'lose':
      return {
        label: 'Loss',
        title: 'Find foods that do more per calorie',
        body: 'Prioritizes foods with stronger fullness, protein, and fiber for the calories they cost.',
      }
    case 'gain':
      return {
        label: 'Gain',
        title: 'Stay fed without making calories impossible',
        body: 'Prioritizes protein and useful calories while still flagging foods that may not keep you full.',
        note: 'Very high-volume foods can blunt appetite, so pair them with denser sides when calories are short.',
      }
    case 'maintain':
      return {
        label: 'Maintain',
        title: 'Build meals that hold steady',
        body: 'Balances fullness, protein, and reasonable calorie density for repeatable everyday choices.',
      }
    default:
      return {
        label: 'Guide',
        title: 'Choose foods that are likely to feel filling',
        body: 'Uses your logged foods when available, plus general patterns that tend to satisfy appetite.',
      }
  }
}

export const FILLING_FOOD_IDEAS: GuideExampleGroup[] = [
  {
    title: 'Protein anchors',
    badge: { label: 'Anchor', tone: 'anchor' },
    body: 'Start here when a meal needs staying power. These make the rest of the plate easier to portion.',
    examples: [
      { name: 'Chicken breast', detail: 'Lean base for bowls, wraps, and plates' },
      { name: 'White fish', detail: 'High protein without much fat' },
      { name: 'Tuna or shrimp', detail: 'Fast protein with little prep' },
      { name: 'Eggs', detail: 'Protein plus fat for breakfast plates' },
      { name: 'Greek yogurt', detail: 'Protein-dense, sweet or savory' },
      { name: 'Cottage cheese', detail: 'Slow protein and minimal prep' },
      { name: 'Tofu or tempeh', detail: 'Plant protein that takes sauce well' },
      { name: 'Turkey slices', detail: 'Quick sandwich or salad anchor' },
    ],
  },
  {
    title: 'Volume builders',
    badge: { label: 'Volume', tone: 'volume' },
    body: 'Use these to make meals look and feel bigger without spending many calories.',
    examples: [
      { name: 'Leafy greens', detail: 'Big plate volume for few calories' },
      { name: 'Broccoli', detail: 'Chewing volume plus fiber' },
      { name: 'Cabbage slaw', detail: 'Crunchy volume that keeps well' },
      { name: 'Zucchini', detail: 'Bulks up pasta, bowls, and eggs' },
      { name: 'Cauliflower rice', detail: 'Stretches rice or stir-fries' },
      { name: 'Carrots', detail: 'Sweet crunch with fiber' },
      { name: 'Berries', detail: 'High-volume snack or yogurt topping' },
      { name: 'Apples or oranges', detail: 'Whole fruit beats juice for fullness' },
    ],
  },
  {
    title: 'Fiber carbs',
    badge: { label: 'Fiber', tone: 'fiber' },
    body: 'These carry more staying power than plain refined carbs, especially when paired with a protein anchor.',
    examples: [
      { name: 'Lentils', detail: 'Protein plus fiber in one base' },
      { name: 'Black beans', detail: 'Bowl filler with staying power' },
      { name: 'Chickpeas', detail: 'Works in salads, wraps, and curries' },
      { name: 'Split peas', detail: 'Useful for thick soups' },
      { name: 'Boiled potatoes', detail: 'Very satisfying when toppings stay measured' },
      { name: 'Oatmeal', detail: 'Slow breakfast base; add protein' },
      { name: 'Barley', detail: 'Chewy grain with more fiber' },
      { name: 'Quinoa or brown rice', detail: 'Reliable bowl base when portioned' },
    ],
  },
  {
    title: 'Calorie add-ons',
    badge: { label: 'Add-on', tone: 'addon' },
    body: 'Use these when meals need more calories. Keep them measured because they move totals quickly.',
    examples: [
      { name: 'Olive oil', detail: 'Easy calories; measure the pour' },
      { name: 'Avocado', detail: 'Creamy fat plus some fiber' },
      { name: 'Nuts', detail: 'Dense snack; pre-portion' },
      { name: 'Peanut butter', detail: 'High-calorie spread; weigh once' },
      { name: 'Cheese', detail: 'Adds calories and flavor fast' },
      { name: 'Rice or pasta', detail: 'Simple calorie base for gain days' },
      { name: 'Granola', detail: 'Works with yogurt; easy to overshoot' },
      { name: 'Dried fruit', detail: 'Compact carbs for extra calories' },
    ],
  },
]

export const LESS_FILLING_PATTERNS: LessFillingPattern[] = [
  {
    title: 'Caloric drinks',
    badge: { label: 'Low fullness', tone: 'low' },
    body: 'Juice, soda, alcohol, sweet coffee drinks, and shakes are capped low because liquids tend to satisfy less.',
  },
  {
    title: 'Oils and spreads',
    badge: { label: 'Low fullness', tone: 'low' },
    body: 'Olive oil, butter, dressings, and sauces add calories quickly without much protein, fiber, or chewing.',
  },
  {
    title: 'Nuts and nut butters',
    badge: { label: 'Low fullness', tone: 'low' },
    body: 'Nutritious and useful for calories, but easy to overshoot because the calorie density is high.',
  },
  {
    title: 'Desserts and snack foods',
    badge: { label: 'Low fullness', tone: 'low' },
    body: 'Chips, candy, pastries, and similar snacks often combine high calories with low protein and low fiber.',
  },
  {
    title: 'High-fat mains',
    badge: { label: 'Light', tone: 'light' },
    body: 'Foods like pizza, burgers, creamy pasta, and fried dishes can fit, but portions matter for fullness per calorie.',
  },
]
