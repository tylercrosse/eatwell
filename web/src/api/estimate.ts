import { apiJson, apiUpload } from './client'
import type { ActivityResult, AnalysisResult, AnalyzeResponse, MenuAnalysisResult } from '../types'

/** Send a food photo to the backend and get back a structured (stateless) estimate. */
export async function postEstimate(file: File): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('file', file, file.name)
  return apiUpload<AnalyzeResponse>('/analyze', form)
}

/** Send a menu photo to the backend and get comparable, read-only menu options. */
export async function postAnalyzeMenu(file: File): Promise<MenuAnalysisResult> {
  const form = new FormData()
  form.append('file', file, file.name)
  return apiUpload<MenuAnalysisResult>('/analyze/menu', form)
}

/** Send a plain-text food description and get back a structured (stateless) estimate. */
export function postEstimateText(description: string): Promise<AnalysisResult> {
  return apiJson<AnalysisResult>('/analyze/text', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
}

/** Estimate calories burned for a free-text activity (tuned to the user's latest weight). */
export function postEstimateActivity(description: string): Promise<ActivityResult> {
  return apiJson<ActivityResult>('/analyze/activity', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
}
