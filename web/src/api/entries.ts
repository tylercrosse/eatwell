import { apiJson } from './client'
import type { DaySummary, Entry, EntryCreate } from '../types'

export function getEntries(dayKey: string): Promise<Entry[]> {
  return apiJson<Entry[]>(`/entries?date=${dayKey}`)
}

export function getDaySummary(dayKey: string): Promise<DaySummary> {
  return apiJson<DaySummary>(`/entries/summary?date=${dayKey}`)
}

export function postEntry(entry: EntryCreate): Promise<Entry> {
  return apiJson<Entry>('/entries', { method: 'POST', body: JSON.stringify(entry) })
}

export function deleteEntry(id: number): Promise<void> {
  return apiJson<void>(`/entries/${id}`, { method: 'DELETE' })
}
