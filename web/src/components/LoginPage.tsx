import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '../lib/env'

interface Props {
  onCredential: (credential: string) => void
  error?: string | null
  pending?: boolean
}

/** Sign-in gate: renders the Google Identity Services button and forwards the ID token. */
export function LoginPage({ onCredential, error, pending }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(() => !!window.google?.accounts?.id)

  // Keep the latest callback in a ref so the render effect doesn't depend on it
  // (App's onCredential isn't referentially stable, which would re-render the button).
  const cbRef = useRef(onCredential)
  useEffect(() => {
    cbRef.current = onCredential
  }, [onCredential])

  // The GSI script (index.html) loads async; poll until window.google is defined.
  useEffect(() => {
    if (ready) return
    const t = setInterval(() => {
      if (window.google?.accounts?.id) {
        setReady(true)
        clearInterval(t)
      }
    }, 100)
    return () => clearInterval(t)
  }, [ready])

  useEffect(() => {
    if (!ready || !buttonRef.current || !GOOGLE_CLIENT_ID) return
    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => cbRef.current(resp.credential),
    })
    window.google!.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
    })
  }, [ready])

  return (
    <div className="login">
      <div className="login__card card">
        <h1 className="login__title">Calorie Tracker</h1>
        <p className="muted">Sign in with Google to track your meals.</p>

        {!GOOGLE_CLIENT_ID ? (
          <p className="error-text">
            Google sign-in isn't configured. Set VITE_GOOGLE_CLIENT_ID and rebuild.
          </p>
        ) : (
          <div ref={buttonRef} className="login__btn" />
        )}

        {pending && <p className="muted">Signing in…</p>}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
