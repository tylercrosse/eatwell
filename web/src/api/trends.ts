import { apiJson } from './client'
import type { TrendHistory } from '../types'

export function getTrendsHistory(to: string): Promise<TrendHistory> {
  return apiJson<TrendHistory>(`/trends/history?to=${to}`)
}
