// Mirrors the backend JSON shapes (snake_case kept as-is to avoid a mapping layer).

export interface FoodItem {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
  is_beverage?: boolean
}

export interface AnalysisResult {
  items: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_weight_g?: number | null
  total_fiber_g?: number | null
  total_sugar_g?: number | null
  total_sodium_mg?: number | null
  is_beverage?: boolean
  serving_size_estimate: string
  confidence: number
}

export interface AnalyzeResponse {
  photo_ref: string
  analysis: AnalysisResult
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export interface Entry {
  id: number
  logged_at: string
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  is_beverage: boolean
  serving_size: string | null
  confidence: number | null
  photo_ref: string | null
  source: string
  meal: string | null
  created_at: string
  updated_at: string
}

export interface EntryCreate {
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
  is_beverage?: boolean
  serving_size?: string | null
  confidence?: number | null
  photo_ref?: string | null
  source?: string
  items_json?: string | null
  meal?: Meal
  logged_at?: string
}

// The signed-in account (GET /api/auth/me, POST /api/auth/google).
export interface AuthUser {
  id: number
  email: string
  name: string | null
  picture: string | null
}

// A recently-logged food, returned by GET /api/foods/recent for one-tap re-logging.
export interface RecentFood {
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
  is_beverage?: boolean
  serving_size?: string | null
}

export interface DaySummary {
  date: string
  entry_count: number
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
}

// Daily targets: a calorie goal + a protein/carbs/fat percent-of-calories split.
// Gram targets are derived client-side (see lib/targets.ts).
export interface Targets {
  calorie_target: number
  protein_pct: number
  carbs_pct: number
  fat_pct: number
  // Body goals (optional). weekly_rate_kg is target change/week (negative = loss).
  goal_weight_kg?: number | null
  goal_body_fat_pct?: number | null
  weekly_rate_kg?: number | null
  // Profile for the BMR/TDEE recommender.
  height_cm?: number | null
  birth_year?: number | null
  sex?: 'male' | 'female' | null
  activity_factor?: number | null
}

// A daily body measurement (GET/POST /api/metrics). Weight stored in kg.
export interface BodyMetric {
  id: number
  date: string // YYYY-MM-DD
  weight_kg: number | null
  body_fat_pct: number | null
  steps: number | null
  note: string | null
}

export interface MetricCreate {
  date?: string
  weight_kg?: number | null
  body_fat_pct?: number | null
  steps?: number | null
  note?: string | null
}

// A logged workout (GET/POST /api/exercise). Calories burned; multiple per day.
export interface ExerciseEntry {
  id: number
  date: string
  description: string
  calories: number
  duration_min: number | null
  source: string
}

export interface ExerciseCreate {
  description: string
  calories: number
  duration_min?: number | null
  source?: string
  date?: string
}

// Per-day exercise-calorie total (GET /api/exercise/range). Sparse — only days with exercise.
export interface ExerciseDaySummary {
  date: string
  entry_count: number
  total_calories: number
}

// AI estimate for a free-text activity (POST /api/analyze/activity).
export interface ActivityResult {
  name: string
  duration_min: number | null
  calories: number
  confidence: number
}
