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

/**
 * Inverse of composeServingSize: split a stored label back into its base label
 * and multiplier, so an existing entry can re-open in the same servings-aware
 * editor it was created in. Unrecognized labels are treated as a 1× base.
 */
export function parseServingSize(label: string | null): { base: string; servings: number } {
  const text = (label ?? '').trim()
  const withBase = text.match(/^(\d+(?:\.\d+)?)×\s*(.+)$/) // "2× 1 bowl"
  if (withBase) return { base: withBase[2].trim(), servings: Number(withBase[1]) }
  const bare = text.match(/^(\d+(?:\.\d+)?)\s+servings$/) // "2 servings"
  if (bare) return { base: '', servings: Number(bare[1]) }
  return { base: text, servings: 1 }
}
