import { apiJson } from './client'
import type { AuthUser } from '../types'

/** Current signed-in user; rejects with ApiError(401) when not authenticated. */
export function getMe(): Promise<AuthUser> {
  return apiJson<AuthUser>('/auth/me')
}

/** Exchange a Google ID token for a session cookie; returns the signed-in user. */
export function loginWithGoogle(credential: string): Promise<AuthUser> {
  return apiJson<AuthUser>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })
}

/** Clear the session cookie. */
export function logout(): Promise<void> {
  return apiJson<void>('/auth/logout', { method: 'POST' })
}
