import { apiJson } from './client'
import type { BodyMetric, MetricCreate } from '../types'

/** Body metrics in [from, to] (inclusive day keys), ascending by date. */
export function getMetrics(from: string, to: string): Promise<BodyMetric[]> {
  return apiJson<BodyMetric[]>(`/metrics?from=${from}&to=${to}`)
}

/** Upsert today's (or a given day's) weight / body-fat. */
export function postMetric(m: MetricCreate): Promise<BodyMetric> {
  return apiJson<BodyMetric>('/metrics', { method: 'POST', body: JSON.stringify(m) })
}

export function deleteMetric(id: number): Promise<void> {
  return apiJson<void>(`/metrics/${id}`, { method: 'DELETE' })
}
