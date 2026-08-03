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

/**
 * Ask for a sign-in email.
 *
 * Always resolves for a well-formed address, whether or not it's on the guest list — the
 * backend deliberately gives the same answer either way so this can't be used to discover
 * who has an account. So a resolved promise means "we accepted the request", not "mail was
 * sent".
 */
export function requestEmailLink(email: string): Promise<{ sent: boolean }> {
  return apiJson<{ sent: boolean }>('/auth/email/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** Redeem a magic-link token or a typed code; returns the signed-in user. */
export function verifyEmailLogin(body: {
  token?: string
  email?: string
  code?: string
}): Promise<AuthUser> {
  return apiJson<AuthUser>('/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Clear the session cookie. */
export function logout(): Promise<void> {
  return apiJson<void>('/auth/logout', { method: 'POST' })
}
