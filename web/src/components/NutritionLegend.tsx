import { cssVar, nutritionLegendItems, type NutritionInput } from '../lib/nutritionDisplay'

interface Props {
  food: NutritionInput
  className?: string
  ariaLabel?: string
}

const classNames = (className?: string) => ['nutrition-legend', className].filter(Boolean).join(' ')

export function NutritionLegend({ food, className, ariaLabel = 'Macros and fiber' }: Props) {
  return (
    <span className={classNames(className)} aria-label={ariaLabel}>
      {nutritionLegendItems(food).map((item) => (
        <span className="nutrition-legend__item" key={item.key}>
          <span className="nutrition-legend__dot" style={{ background: cssVar(item.colorVar) }} />
          <span>{item.label}</span>
          <span className="nutrition-legend__value">{item.value}</span>
        </span>
      ))}
    </span>
  )
}
