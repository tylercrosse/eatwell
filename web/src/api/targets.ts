import { apiJson } from './client'
import type { Targets } from '../types'

export function getTargets(): Promise<Targets> {
  return apiJson<Targets>('/targets')
}

export function putTargets(t: Targets): Promise<Targets> {
  return apiJson<Targets>('/targets', { method: 'PUT', body: JSON.stringify(t) })
}
