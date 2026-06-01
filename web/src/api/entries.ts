import { apiJson } from './client'
import type { DaySummary, Entry, EntryCreate } from '../types'

export function getEntries(dayKey: string): Promise<Entry[]> {
  return apiJson<Entry[]>(`/entries?date=${dayKey}`)
}

export function getDaySummary(dayKey: string): Promise<DaySummary> {
  return apiJson<DaySummary>(`/entries/summary?date=${dayKey}`)
}

/** Per-day totals across [from, to] (inclusive day keys). Sparse — only days with entries. */
export function getEntriesRange(from: string, to: string): Promise<DaySummary[]> {
  return apiJson<DaySummary[]>(`/entries/range?from=${from}&to=${to}`)
}

export function postEntry(entry: EntryCreate): Promise<Entry> {
  return apiJson<Entry>('/entries', { method: 'POST', body: JSON.stringify(entry) })
}

export function patchEntry(id: number, patch: Partial<EntryCreate>): Promise<Entry> {
  return apiJson<Entry>(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteEntry(id: number): Promise<void> {
  return apiJson<void>(`/entries/${id}`, { method: 'DELETE' })
}
