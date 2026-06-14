import { cssVar, macroCalories, MACRO_ORDER, NUTRITION_DISPLAY } from '../lib/nutritionDisplay'

interface Props {
  protein_g: number
  carbs_g: number
  fat_g: number
}

/**
 * A thin stacked bar of a food/meal's macro composition **by calories** (protein/fat/carbs). It
 * reuses the same `--macro-*` tokens as the day-summary bars and the Trends charts, so macros read
 * the same everywhere instead of being plain text on the meal/entry rows. Renders nothing when
 * there are no macro calories to split.
 */
export function MacroBar({ protein_g, carbs_g, fat_g }: Props) {
  const food = { protein_g, carbs_g, fat_g }
  const segments = MACRO_ORDER.map((key) => ({
    key,
    kcal: macroCalories(food, key),
  })).filter((s) => s.kcal > 0)
  const total = segments.reduce((sum, s) => sum + s.kcal, 0)
  if (total <= 0) return null

  return (
    <span className="macro-comp" aria-hidden>
      {segments.map((s) => (
        <span
          key={s.key}
          className="macro-comp__seg"
          style={{ width: `${(s.kcal / total) * 100}%`, background: cssVar(NUTRITION_DISPLAY[s.key].colorVar) }}
          title={`${NUTRITION_DISPLAY[s.key].label} ${Math.round((s.kcal / total) * 100)}%`}
        />
      ))}
    </span>
  )
}
