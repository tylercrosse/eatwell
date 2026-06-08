// Chart palette, mapped by *concept* so the same idea reads the same across every chart. Recharts
// writes its `fill`/`stroke` props as SVG presentation attributes, which don't accept CSS `var()`,
// so chart colors can't reference the CSS custom properties directly. Token-backed entries are noted
// alongside — keep those in sync with index.css `:root`; a couple are chart-only (no CSS token).
export const CHART_COLORS = {
  protein: '#60a5fa', // --macro-protein
  carbs: '#fbbf24', // --macro-carbs
  fat: '#f472b6', // --macro-fat
  accent: '#34d399', // --accent — trend of actuals (calorie + weight "Trend") and on-target/deficit
  danger: '#f87171', // --danger — off-target / surplus
  expenditure: '#fb923c', // --exp-exercise (burn) — the expenditure line, on its own
  goal: '#a78bfa', // --exp-bmr — the dashed goal-pace projection (where you're aiming)
  projection: '#38bdf8', // chart-only (sky) — balance accumulation: "Cumulative" + "Predicted" (its kin)
  muted: '#94a3b8', // --muted
  grid: '#334155', // --border-ish grid lines
} as const
