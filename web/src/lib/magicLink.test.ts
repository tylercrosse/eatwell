import { describe, expect, it } from 'vitest'
import { readMagicLinkToken } from './magicLink'

describe('readMagicLinkToken', () => {
  it('reads the token from a sign-in link', () => {
    expect(readMagicLinkToken('?token=abc123')).toBe('abc123')
  })

  it('finds it alongside other params', () => {
    expect(readMagicLinkToken('?utm_source=mail&token=abc123')).toBe('abc123')
  })

  it('returns null when there is no token', () => {
    expect(readMagicLinkToken('')).toBeNull()
    expect(readMagicLinkToken('?')).toBeNull()
    expect(readMagicLinkToken('?other=1')).toBeNull()
  })

  it('treats an empty or whitespace-only token as absent', () => {
    expect(readMagicLinkToken('?token=')).toBeNull()
    expect(readMagicLinkToken('?token=%20%20')).toBeNull()
  })

  it('ignores an absurdly long value rather than posting it', () => {
    expect(readMagicLinkToken(`?token=${'x'.repeat(5000)}`)).toBeNull()
  })

  it('decodes percent-encoding, since mail clients rewrite links', () => {
    expect(readMagicLinkToken('?token=a%2Db%5Fc')).toBe('a-b_c')
  })
})
