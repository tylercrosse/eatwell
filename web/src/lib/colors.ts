import type { ResolvedTheme } from './theme'

// Chart palette, mapped by *concept* so the same idea reads the same across every chart. Recharts
// writes its `fill`/`stroke` props as SVG presentation attributes, which don't accept CSS `var()`,
// so chart colors can't reference the CSS custom properties directly — they're duplicated here, one
// palette per theme. Keep each palette in sync with the matching `[data-theme]` block in index.css.
// Components read the active palette via `useChartColors()` (see theme.ts), not this object directly.
export interface ChartPalette {
  protein: string // --macro-protein
  carbs: string // --macro-carbs
  fat: string // --macro-fat — also the body-fat line
  accent: string // --accent — trend of actuals + on-target/deficit
  danger: string // --danger — off-target / surplus
  expenditure: string // --exp-exercise (burn) — the expenditure line
  goal: string // --exp-bmr — dashed goal-pace projection (where you're aiming)
  projection: string // balance accumulation: "Cumulative" + "Predicted" (its kin)
  muted: string // --muted — axis ticks, zero line
  grid: string // --border — grid lines
  surface: string // --surface — tooltip background
  border: string // --border — tooltip border
  text: string // --text — tooltip item text
}

export const CHART_PALETTES: Record<ResolvedTheme, ChartPalette> = {
  dark: {
    protein: '#60a5fa',
    carbs: '#fbbf24',
    fat: '#f472b6',
    accent: '#34d399',
    danger: '#f87171',
    expenditure: '#fb923c',
    goal: '#a78bfa',
    projection: '#38bdf8',
    muted: '#94a3b8',
    grid: '#334155',
    surface: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
  },
  light: {
    protein: '#2563eb',
    carbs: '#d97706',
    fat: '#db2777',
    accent: '#059669',
    danger: '#dc2626',
    expenditure: '#ea580c',
    goal: '#7c3aed',
    projection: '#0284c7',
    muted: '#64748b',
    grid: '#cbd5e1',
    surface: '#ffffff',
    border: '#cbd5e1',
    text: '#0f172a',
  },
  'github-dark': {
    protein: '#58a6ff',
    carbs: '#d29922',
    fat: '#db61a2',
    accent: '#3fb950',
    danger: '#f85149',
    expenditure: '#f0883e',
    goal: '#a371f7',
    projection: '#39c5cf',
    muted: '#8b949e',
    grid: '#30363d',
    surface: '#161b22',
    border: '#30363d',
    text: '#c9d1d9',
  },
  'solarized-dark': {
    protein: '#268bd2',
    carbs: '#b58900',
    fat: '#d33682',
    accent: '#859900',
    danger: '#dc322f',
    expenditure: '#cb4b16',
    goal: '#6c71c4',
    projection: '#2aa198',
    muted: '#657b83',
    grid: '#0f4d5e',
    surface: '#073642',
    border: '#0f4d5e',
    text: '#93a1a1',
  },
  'gruvbox-dark': {
    protein: '#83a598',
    carbs: '#fabd2f',
    fat: '#d3869b',
    accent: '#b8bb26',
    danger: '#fb4934',
    expenditure: '#fe8019',
    goal: '#b16286',
    projection: '#8ec07c',
    muted: '#a89984',
    grid: '#665c54',
    surface: '#3c3836',
    border: '#665c54',
    text: '#ebdbb2',
  },
}
