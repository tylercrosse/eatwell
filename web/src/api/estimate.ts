import { apiUpload } from './client'
import type { AnalyzeResponse } from '../types'

/** Send a food photo to the backend and get back a structured (stateless) estimate. */
export async function postEstimate(file: File): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('file', file, file.name)
  return apiUpload<AnalyzeResponse>('/analyze', form)
}
