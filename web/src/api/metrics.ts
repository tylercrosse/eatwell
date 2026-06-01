import { apiJson } from './client'
import type { BodyMetric, MetricCreate } from '../types'

/** Body metrics in [from, to] (inclusive day keys), ascending by date. */
export function getMetrics(from: string, to: string): Promise<BodyMetric[]> {
  return apiJson<BodyMetric[]>(`/metrics?from=${from}&to=${to}`)
}

/** Most recent metric that has a weight (for step→kcal when today's weight is absent), or null. */
export function getLatestMetric(): Promise<BodyMetric | null> {
  return apiJson<BodyMetric | null>('/metrics/latest')
}

/** Upsert today's (or a given day's) weight / body-fat. */
export function postMetric(m: MetricCreate): Promise<BodyMetric> {
  return apiJson<BodyMetric>('/metrics', { method: 'POST', body: JSON.stringify(m) })
}

export interface MetricPatch {
  weight_kg?: number | null
  body_fat_pct?: number | null
  steps?: number | null
  note?: string | null
}

/** Partial update of a metric — an explicit null clears that field (e.g. removing steps). */
export function patchMetric(id: number, patch: MetricPatch): Promise<BodyMetric> {
  return apiJson<BodyMetric>(`/metrics/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteMetric(id: number): Promise<void> {
  return apiJson<void>(`/metrics/${id}`, { method: 'DELETE' })
}
