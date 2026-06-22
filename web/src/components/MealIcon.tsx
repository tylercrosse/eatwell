import type { CSSProperties } from 'react'
import type { Meal } from '../types'
import { mealIconFor } from '../lib/mealIcons'

interface Props {
  meal: Meal
  size?: number
  className?: string
}

export function MealIcon({ meal, size = 20, className = '' }: Props) {
  const icon = mealIconFor(meal)
  const classes = ['meal-icon', className].filter(Boolean).join(' ')
  return (
    <span
      className={classes}
      style={{ '--meal-icon-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <img className="meal-icon__img" src={icon.src} alt="" width={size} height={size} draggable={false} />
    </span>
  )
}
