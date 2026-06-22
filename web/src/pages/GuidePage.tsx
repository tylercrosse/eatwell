import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuScanner } from '../components/MenuScanner'
import { CalorieValue } from '../components/CalorieValue'
import { FoodIcon } from '../components/FoodIcon'
import { MacroBar } from '../components/MacroBar'
import { NutritionLegend } from '../components/NutritionLegend'
import { StayingPowerBadge } from '../components/StayingPowerBadge'
import { getRecentFoods } from '../api/foods'
import { getLatestMetric } from '../api/metrics'
import { getTargets } from '../api/targets'
import {
  FILLING_FOOD_IDEAS,
  LESS_FILLING_PATTERNS,
  guideGoalCopy,
  rankGuideFoods,
  type GuideGoal,
  type RankedGuideFood,
  type GuideRoleBadge,
  type GuideRoleBadgeTone,
  type GuideStaticBadge,
  type GuideStaticBadgeTone,
} from '../lib/guide'
import { isBeverageForFullness } from '../lib/fullness'
import { DEFAULT_TARGETS, goalDirection } from '../lib/targets'
import { useTheme } from '../lib/theme'
import type { RecentFood } from '../types'

const EMPTY_RECENT: RecentFood[] = []
const MAX_PERSONAL_FOODS = 10
const STATIC_BADGE_CLASS: Record<GuideStaticBadgeTone, string> = {
  strong: 'staying-power--strong',
  solid: 'staying-power--solid',
  moderate: 'staying-power--moderate',
  light: 'staying-power--light',
}
const ROLE_BADGE_CLASS: Record<GuideRoleBadgeTone, string> = {
  anchor: 'guide-role-badge--anchor',
  volume: 'guide-role-badge--volume',
  fiber: 'guide-role-badge--fiber',
  addon: 'guide-role-badge--addon',
}

function guideServingMeta(food: RecentFood): string {
  const serving = food.serving_size?.trim() || 'logged serving'
  const parts = [serving]
  if (food.times_logged && food.times_logged > 1) parts.push(`${food.times_logged}x logged`)
  return parts.join(' · ')
}

function GuideFoodRow({ item, simple }: { item: RankedGuideFood; simple: boolean }) {
  const { food, reason } = item
  return (
    <div className={`guide-food${simple ? ' guide-food--simple' : ' guide-food--detailed'}`}>
      <FoodIcon entry={food} />
      <div className="guide-food__main">
        <div className="guide-food__top">
          <span className="guide-food__name">{food.food_name}</span>
          <StayingPowerBadge power={item.stayingPower} variant="compact" explain />
          {isBeverageForFullness(food) && <span className="guide-tag guide-tag--warn">Drink</span>}
        </div>
        <span className="guide-food__meta">{guideServingMeta(food)}</span>
        {!simple && (
          <>
            <MacroBar protein_g={food.protein_g} carbs_g={food.carbs_g} fat_g={food.fat_g} />
            <NutritionLegend food={food} />
          </>
        )}
        <p className="guide-food__why">{reason}</p>
      </div>
      <CalorieValue calories={food.calories} />
    </div>
  )
}

function StaticGuideBadge({ badge }: { badge: GuideStaticBadge }) {
  return <span className={`staying-power guide-badge ${STATIC_BADGE_CLASS[badge.tone]}`}>{badge.label}</span>
}

function RoleGuideBadge({ badge }: { badge: GuideRoleBadge }) {
  return <span className={`guide-role-badge ${ROLE_BADGE_CLASS[badge.tone]}`}>{badge.label}</span>
}

function resolveGoal(targets: typeof DEFAULT_TARGETS, currentWeightKg: number | null | undefined): GuideGoal {
  return goalDirection(targets.goal_weight_kg, currentWeightKg) ?? 'unknown'
}

export function GuidePage() {
  const { simpleView: simple } = useTheme() // Detailed by default; switched in Settings
  const foodsQuery = useQuery({
    queryKey: ['foods', 'guide', 'frecency'],
    queryFn: () => getRecentFoods(undefined, 'frecency', 50),
  })
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getTargets })
  const latestWeightQuery = useQuery({ queryKey: ['metrics', 'latest'], queryFn: getLatestMetric })

  const foods = foodsQuery.data ?? EMPTY_RECENT
  const targets = targetsQuery.data ?? DEFAULT_TARGETS
  const goal = resolveGoal(targets, latestWeightQuery.data?.weight_kg)
  const copy = guideGoalCopy(goal)
  const rankedFoods = useMemo(() => rankGuideFoods(foods, goal), [foods, goal])
  const visibleFoods = rankedFoods.slice(0, MAX_PERSONAL_FOODS)
  const unscoredCount = Math.max(0, foods.length - rankedFoods.length)

  return (
    <div className="page guide-page">
      <section className="card guide-hero">
        <span className="guide-eyebrow">{copy.label}</span>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
        {copy.note && <p className="guide-note">{copy.note}</p>}
      </section>

      <MenuScanner goal={goal} simple={simple} />

      <section className="card guide-section">
        <div className="guide-section__head">
          <div>
            <span className="guide-eyebrow">Personalized</span>
            <h2>Your best logged servings</h2>
            <p className="guide-section__sub">Ranked by the same staying-power model used on logged meals.</p>
          </div>
          {rankedFoods.length > 0 && <span className="guide-count">{rankedFoods.length} ranked</span>}
        </div>

        {foodsQuery.isLoading ? (
          <p className="muted">Loading your foods...</p>
        ) : foodsQuery.isError ? (
          <p className="error-text">Couldn't load your recent foods.</p>
        ) : visibleFoods.length === 0 ? (
          <p className="empty guide-empty">
            Log foods with calories, protein, and fiber to build a personal staying-power list. Until then, use the ideas below.
          </p>
        ) : (
          <>
            <div className="guide-food-list">
              {visibleFoods.map((item) => (
                <GuideFoodRow key={item.food.food_name} item={item} simple={simple} />
              ))}
            </div>
            {unscoredCount > 0 && (
              <p className="guide-footnote">
                {unscoredCount} recent {unscoredCount === 1 ? 'food was' : 'foods were'} skipped because staying power needs
                usable calories.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card guide-section">
        <div className="guide-section__head">
          <div>
            <span className="guide-eyebrow">Ideas</span>
            <h2>Build a filling meal</h2>
            <p className="guide-section__sub">
              Pick a protein anchor, add volume or fiber, then adjust calories with measured add-ons.
            </p>
          </div>
        </div>
        <div className="guide-groups">
          {FILLING_FOOD_IDEAS.map((group) => (
            <div className="guide-group" key={group.title}>
              <div className="guide-static-head">
                <h3>{group.title}</h3>
                <RoleGuideBadge badge={group.badge} />
              </div>
              <p>{group.body}</p>
              <div className="guide-example-list">
                {group.examples.map((example) => (
                  <div className="guide-example" key={example.name}>
                    <span className="guide-example__name">{example.name}</span>
                    <span className="guide-example__detail">{example.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card guide-section">
        <div className="guide-section__head">
          <div>
            <span className="guide-eyebrow">Portion intentionally</span>
            <h2>Lower staying power for the calories</h2>
          </div>
        </div>
        <div className="guide-patterns">
          {LESS_FILLING_PATTERNS.map((pattern) => (
            <div className="guide-pattern" key={pattern.title}>
              <div className="guide-static-head">
                <h3>{pattern.title}</h3>
                <StaticGuideBadge badge={pattern.badge} />
              </div>
              <p>{pattern.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
