import { apiJson } from './client'
import type { ExerciseCreate, ExerciseDaySummary, ExerciseEntry } from '../types'

/** A day's logged exercise, oldest first. */
export function getExercise(dayKey: string): Promise<ExerciseEntry[]> {
  return apiJson<ExerciseEntry[]>(`/exercise?date=${dayKey}`)
}

/** Per-day exercise-calorie totals across [from, to] (inclusive). Sparse — only days with exercise. */
export function getExerciseRange(from: string, to: string): Promise<ExerciseDaySummary[]> {
  return apiJson<ExerciseDaySummary[]>(`/exercise/range?from=${from}&to=${to}`)
}

export function postExercise(e: ExerciseCreate): Promise<ExerciseEntry> {
  return apiJson<ExerciseEntry>('/exercise', { method: 'POST', body: JSON.stringify(e) })
}

export function patchExercise(id: number, patch: Partial<ExerciseCreate>): Promise<ExerciseEntry> {
  return apiJson<ExerciseEntry>(`/exercise/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteExercise(id: number): Promise<void> {
  return apiJson<void>(`/exercise/${id}`, { method: 'DELETE' })
}
