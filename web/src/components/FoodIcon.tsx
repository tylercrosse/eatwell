import type { CSSProperties } from 'react'
import { resolveCategory, type ResolvableEntry } from '../lib/foodCategory'
import { iconFor } from '../lib/foodCategoryIcons'

interface Props {
  entry: ResolvableEntry
  size?: number
}

/**
 * A leading category glyph for the food's visual form.
 * Decorative: the food name is the accessible label, so the icon is aria-hidden.
 */
export function FoodIcon({ entry, size = 24 }: Props) {
  const category = resolveCategory(entry)
  const icon = iconFor(category)
  return (
    <span
      className="food-icon"
      data-category={category}
      style={{ '--food-icon-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <img className="food-icon__img" src={icon.src} alt="" width={size} height={size} draggable={false} />
    </span>
  )
}
