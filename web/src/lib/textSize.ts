// App-wide text scaling. Every font-size in index.css is in `rem`, so setting the root font-size
// scales all text proportionally; spacing is in `px`, so layout boxes stay put (text grows inside
// roughly the same containers rather than the whole UI "zooming"). The percentages are relative to
// the browser's base size (usually 16px): default 16px · large 18px · larger 20px.

// `id` is the stable key (localStorage value + scale lookup) — never rename it. `label` is
// user-facing and free to change.
export type TextSize = 'default' | 'large' | 'larger'

export const TEXT_SIZES: ReadonlyArray<{ id: TextSize; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'large', label: 'Large' },
  { id: 'larger', label: 'Larger' },
]

export const TEXT_SIZE_IDS = TEXT_SIZES.map((t) => t.id) as TextSize[]
export const TEXT_SIZE_STORAGE_KEY = 'text-size'
export const DEFAULT_TEXT_SIZE: TextSize = 'default'

// Root font-size per option. Mirrored in the index.html no-flash bootstrap — keep the two in sync.
export const TEXT_SIZE_SCALE: Record<TextSize, string> = {
  default: '100%',
  large: '112.5%',
  larger: '125%',
}

/** Apply a text size to the document by setting the root font-size (all `rem` text follows). */
export function applyTextSize(size: TextSize): void {
  document.documentElement.style.fontSize = TEXT_SIZE_SCALE[size]
}
