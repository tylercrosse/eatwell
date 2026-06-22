import { createElement } from 'react'
import { resolveCategory, type ResolvableEntry } from '../lib/foodCategory'
import { iconFor } from '../lib/foodCategoryIcons'

interface Props {
  entry: ResolvableEntry
  size?: number
}

/**
 * A small theme-tinted chip showing the food's category glyph (its visual form).
 * Decorative: the food name is the accessible label, so the icon is aria-hidden.
 */
export function FoodIcon({ entry, size = 20 }: Props) {
  const category = resolveCategory(entry)
  // createElement (not <Icon/>) so the dynamic component lookup isn't flagged as a
  // component declared during render by react-hooks/static-components.
  return (
    <span className="food-icon" data-category={category} aria-hidden="true">
      {createElement(iconFor(category), { size, strokeWidth: 1.75 })}
    </span>
  )
}
