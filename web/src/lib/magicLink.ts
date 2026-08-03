/**
 * Reading the magic-link token out of the URL.
 *
 * Sign-in emails link to `/?token=...` rather than a path like `/auth/verify`, because the
 * backend's static mount serves index.html for `/` but 404s unknown paths on a cold hit —
 * and there's no router here to handle one anyway.
 *
 * Kept pure and separate from the component so it's testable: vitest runs in the node
 * environment here (no jsdom, no testing-library), so `src/lib/*.test.ts` is the only test
 * surface in this app.
 */

/** Longest token we'll look at. Real ones are ~43 chars; anything wilder is junk or an attack. */
const MAX_TOKEN_LENGTH = 512

/**
 * Extract the sign-in token from a query string, or null when there isn't a usable one.
 *
 * @param search - `window.location.search`, e.g. `"?token=abc"`.
 */
export function readMagicLinkToken(search: string): string | null {
  if (!search) return null
  const raw = new URLSearchParams(search).get('token')
  if (!raw) return null

  const token = raw.trim()
  if (!token || token.length > MAX_TOKEN_LENGTH) return null
  return token
}
