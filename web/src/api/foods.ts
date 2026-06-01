import { apiJson } from './client'
import type { RecentFood } from '../types'

/** Recently-logged distinct foods, newest first, for one-tap re-logging (no AI call). */
export function getRecentFoods(q?: string): Promise<RecentFood[]> {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return apiJson<RecentFood[]>(`/foods/recent${qs}`)
}
