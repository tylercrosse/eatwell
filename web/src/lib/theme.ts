import { createContext, useContext } from 'react'
import { CHART_PALETTES, type ChartPalette } from './colors'

// A `ResolvedTheme` is an actual `[data-theme]` value the CSS understands. `ThemeId` adds the
// `system` option, which resolves to light/dark from `prefers-color-scheme`.
export type ResolvedTheme = 'light' | 'dark' | 'github-dark' | 'solarized-dark' | 'gruvbox-dark'
export type ThemeId = 'system' | ResolvedTheme

// `id` is the stable key (localStorage value + `[data-theme]` selector + palette key) — never
// rename it. `label` is user-facing and free to change.
export const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'github-dark', label: 'Black' },
  { id: 'solarized-dark', label: 'Cool' },
  { id: 'gruvbox-dark', label: 'Warm' },
]

export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[]
export const THEME_STORAGE_KEY = 'theme'
export const DEFAULT_THEME: ThemeId = 'system'

// When on "System", the OS light/dark preference is followed — but with several dark themes the
// user picks which one is used at night (light has one option, so it isn't configurable yet).
const DARK_IDS: readonly string[] = ['dark', 'github-dark', 'solarized-dark', 'gruvbox-dark']
export const DARK_THEMES = THEMES.filter(
  (t): t is { id: ResolvedTheme; label: string } => DARK_IDS.includes(t.id),
)
export const DARK_THEME_IDS = DARK_THEMES.map((t) => t.id)
export const SYSTEM_DARK_STORAGE_KEY = 'theme-system-dark'
export const DEFAULT_SYSTEM_DARK: ResolvedTheme = 'dark'

// Each resolved theme's base background, mirrored from the matching index.css `--bg`. Drives the
// `<meta name="theme-color">` (the iOS status-bar tint). Also duplicated in the index.html no-flash
// bootstrap — keep the three in sync.
export const THEME_BG: Record<ResolvedTheme, string> = {
  light: '#f8fafc',
  dark: '#0f172a',
  'github-dark': '#0d1117',
  'solarized-dark': '#002b36',
  'gruvbox-dark': '#282828',
}

/** Apply a resolved theme to the document: set `data-theme` + the theme-color meta. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[resolved])
}

export interface ThemeContextValue {
  theme: ThemeId // the user's choice (may be 'system')
  resolved: ResolvedTheme // what's actually rendered
  setTheme: (id: ThemeId) => void
  systemDark: ResolvedTheme // which dark theme 'system' uses when the OS is dark
  setSystemDark: (id: ResolvedTheme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

/** The active chart palette (Recharts can't read CSS vars, so charts pull hex from here). */
export function useChartColors(): ChartPalette {
  return CHART_PALETTES[useTheme().resolved]
}
