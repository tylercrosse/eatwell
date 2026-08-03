import { apiJson } from './client'
import type { MintedInviteLink } from '../types'

/**
 * Mint a shareable invite link. Owner only; anyone else gets ApiError(403).
 *
 * The returned `url` exists in this response and nowhere else — only its hash is stored, so
 * it can't be fetched again later. Hand it over now or mint another.
 */
export function createInviteLink(body: {
  note?: string
  max_uses?: number
}): Promise<MintedInviteLink> {
  return apiJson<MintedInviteLink>('/invites/links', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
