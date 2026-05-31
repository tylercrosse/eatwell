/** Trim trailing zeros so 1.50 → "1.5" and 2 → "2". */
export function formatServings(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** Compose the stored serving label, folding in the multiplier when it isn't 1. */
export function composeServingSize(label: string, servings: number): string {
  const base = label.trim()
  if (servings === 1) return base
  const mult = formatServings(servings)
  return base ? `${mult}× ${base}` : `${mult} servings`
}
