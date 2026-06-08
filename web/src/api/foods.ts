import { apiJson } from './client'
import type { BarcodeFood, RecentFood } from '../types'

export type RecentSort = 'recent' | 'frecency'

/**
 * Distinct logged foods for one-tap re-logging (no AI call).
 * - `q` substring-filters by name (lets the user reach any prior food, not just the top of the list).
 * - `sort` is `recent` (newest first) or `frecency` (frequency × recency — staples stay near the top).
 * - `limit` caps the result count (default 15; raise it when searching a larger history).
 */
export function getRecentFoods(q?: string, sort?: RecentSort, limit?: number): Promise<RecentFood[]> {
  const params = new URLSearchParams()
  if (q && q.trim()) params.set('q', q.trim())
  if (sort) params.set('sort', sort)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return apiJson<RecentFood[]>(`/foods/recent${qs ? `?${qs}` : ''}`)
}

/**
 * Look up a packaged food by scanned barcode (US-first: USDA Branded, then Open Food Facts).
 * Throws ApiError 404 when no product matches, 400 for an implausible code.
 */
export function getBarcodeFood(code: string): Promise<BarcodeFood> {
  return apiJson<BarcodeFood>(`/foods/barcode/${encodeURIComponent(code)}`)
}
