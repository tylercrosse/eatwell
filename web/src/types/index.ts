// Mirrors the backend JSON shapes (snake_case kept as-is to avoid a mapping layer).

export interface FoodItem {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface AnalysisResult {
  items: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  serving_size_estimate: string
  confidence: number
}

export interface AnalyzeResponse {
  photo_ref: string
  analysis: AnalysisResult
}

export interface Entry {
  id: number
  logged_at: string
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: string | null
  confidence: number | null
  photo_ref: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface EntryCreate {
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size?: string | null
  confidence?: number | null
  photo_ref?: string | null
  source?: string
  items_json?: string | null
  logged_at?: string
}

export interface DaySummary {
  date: string
  entry_count: number
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
}
