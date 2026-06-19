import type { ReactNode } from 'react'
import { round } from '../lib/totals'

interface Props {
  calories: number
  className?: string
  /** Extra content stacked under the figure (e.g. a confidence badge on menu rows). */
  children?: ReactNode
}

/**
 * The prominent right-aligned kcal figure. Shared by log entries, guide foods, and menu choices so
 * the calorie value — the number users scan for most — reads the same everywhere. Reuses the
 * `.entry__right` / `.entry__cal` tokens already used by the exercise and metric rows.
 */
export function CalorieValue({ calories, className, children }: Props) {
  return (
    <div className={['entry__right', className].filter(Boolean).join(' ')}>
      <span className="entry__cal">{round(calories)}</span>
      <span className="entry__cal-unit">kcal</span>
      {children}
    </div>
  )
}
