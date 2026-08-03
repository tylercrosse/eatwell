import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { requestEmailLink, verifyEmailLogin } from '../api/auth'
import { ApiError } from '../api/client'
import type { AuthUser } from '../types'

interface Props {
  onSignedIn: (user: AuthUser) => void
}

/**
 * Email sign-in, for people without a Google account.
 *
 * Two steps: ask for a link, then either tap it in the email or type the code back in here.
 * The code matters more than it looks — an installed home-screen PWA on iOS has a cookie jar
 * separate from Safari, so a link tapped in Mail signs you in *in Safari* while this app still
 * shows the login screen. Typing the code keeps the whole exchange inside the app.
 */
export function EmailSignIn({ onSignedIn }: Props) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const request = useMutation({
    mutationFn: requestEmailLink,
    onMutate: () => setError(null),
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : "Couldn't send the email. Please try again.",
      ),
  })

  const verify = useMutation({
    mutationFn: verifyEmailLogin,
    onMutate: () => setError(null),
    onSuccess: onSignedIn,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Sign-in failed. Please try again.'),
  })

  const trimmedEmail = email.trim()
  const sent = request.isSuccess

  if (!sent) {
    return (
      <form
        className="login__form"
        onSubmit={(e) => {
          e.preventDefault()
          request.mutate(trimmedEmail)
        }}
      >
        <label className="field">
          <span className="field__label">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button
          className="btn btn--primary"
          type="submit"
          disabled={!trimmedEmail || request.isPending}
        >
          {request.isPending ? 'Sending…' : 'Email me a link'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    )
  }

  return (
    <form
      className="login__form"
      onSubmit={(e) => {
        e.preventDefault()
        verify.mutate({ email: trimmedEmail, code: code.trim() })
      }}
    >
      {/* Careful wording: the backend answers identically for unknown addresses, so promising
          "we sent it" would be a lie for anyone not on the guest list. */}
      <p className="muted">
        If <strong>{trimmedEmail}</strong> has access, a sign-in link is on its way. Tap it, or
        enter the code below.
      </p>
      <label className="field">
        <span className="field__label">Code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          placeholder="123456"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <button
        className="btn btn--primary"
        type="submit"
        disabled={code.trim().length !== 6 || verify.isPending}
      >
        {verify.isPending ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p className="error-text">{error}</p>}
      <button
        className="login__link-btn"
        type="button"
        disabled={request.isPending}
        onClick={() => {
          setCode('')
          setError(null)
          request.mutate(trimmedEmail)
        }}
      >
        {request.isPending ? 'Sending…' : 'Send a new link'}
      </button>
    </form>
  )
}
