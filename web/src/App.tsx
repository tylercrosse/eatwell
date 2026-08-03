import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogPage } from './pages/LogPage'
import { GuidePage } from './pages/GuidePage'
import { GoalsPage } from './pages/GoalsPage'
import { AppIcon } from './components/AppIcon'
import { LoginPage } from './components/LoginPage'
import { SettingsMenu } from './components/SettingsMenu'
import { InviteSheet } from './components/InviteSheet'
import { getMe, loginWithGoogle, logout, verifyEmailLogin } from './api/auth'
import { ApiError } from './api/client'
import { localDayKey } from './lib/date'
import { hideBootSplash } from './lib/bootSplash'
import { readInviteToken, readMagicLinkToken } from './lib/magicLink'
import type { AuthUser } from './types'

// Lazy so the charting lib (recharts) is a separate chunk, off the initial load path.
const TrendsPage = lazy(() => import('./pages/TrendsPage').then((m) => ({ default: m.TrendsPage })))

type Tab = 'log' | 'guide' | 'trends' | 'goals'

export default function App() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('log')
  const [day, setDay] = useState<string>(localDayKey()) // the day the Log page is viewing
  const [loginError, setLoginError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  // A magic-link token arrives as /?token=... — captured once on mount, before the effect
  // below strips it from the URL, so it survives the rewrite.
  const [magicToken] = useState(() => readMagicLinkToken(window.location.search))
  // A shared invite (/?invite=...) doesn't identify anyone — it authorises signup. Held here
  // and handed to whichever provider the newcomer picks; the backend spends it on success.
  const [inviteToken] = useState(() => readInviteToken(window.location.search))

  // 401 here just means "not signed in" — surface the login screen, don't retry.
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false })

  const verifyLink = useMutation({
    mutationFn: verifyEmailLogin,
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
    onError: (e) =>
      setLoginError(
        e instanceof ApiError
          ? e.message
          : 'That sign-in link did not work. Please request a new one.',
      ),
  })

  // Clear both tokens from the address bar so neither lingers in history or gets re-shared.
  // Safe to do immediately: both were captured into state during the initial render.
  useEffect(() => {
    if (magicToken || inviteToken) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [magicToken, inviteToken])

  // Redeem the sign-in link, exactly once. The ref latch matters: StrictMode double-invokes
  // effects in dev, and a second call would consume the already-spent single-use token and
  // report failure on a sign-in that actually succeeded.
  const redeemed = useRef(false)
  useEffect(() => {
    if (!magicToken || redeemed.current) return
    redeemed.current = true
    verifyLink.mutate({ token: magicToken })
    // verifyLink is a fresh object each render; depending on it would re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magicToken])

  // Dismiss the index.html boot splash once auth resolves (signed in or 401). Held through the
  // link exchange too, so arriving from an email doesn't flash the login screen on the way in.
  const settling = meQuery.isLoading || (!!magicToken && verifyLink.isPending)
  useEffect(() => {
    if (!settling) hideBootSplash()
  }, [settling])

  const login = useMutation({
    mutationFn: loginWithGoogle,
    onMutate: () => setLoginError(null),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
    onError: (e) =>
      setLoginError(e instanceof ApiError ? e.message : 'Sign-in failed. Please try again.'),
  })

  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.clear(), // drop the session + all cached user data
  })

  const onCredential = useCallback(
    (credential: string) => login.mutate({ credential, inviteToken }),
    [login, inviteToken],
  )
  // Email sign-in completes inside EmailSignIn; App just adopts the resulting user.
  const onSignedIn = useCallback(
    (user: AuthUser) => queryClient.setQueryData(['me'], user),
    [queryClient],
  )
  // Jump to a specific day on the Log tab (used by the Trends charts).
  const goToDay = useCallback((d: string) => {
    setDay(d)
    setTab('log')
  }, [])

  // The index.html boot splash already covers the screen while auth resolves; render
  // nothing underneath so there's no flash of content as the splash fades out.
  if (settling) return null

  const me = meQuery.data
  if (!me) {
    return (
      <LoginPage
        onCredential={onCredential}
        onSignedIn={onSignedIn}
        inviteToken={inviteToken}
        error={loginError}
        pending={login.isPending}
      />
    )
  }

  return (
    <div className="app">
      <header className="app__header app__header--row">
        <h1>Calorie Tracker</h1>
        <div className="app__header-actions">
          {me.is_owner && (
            <button
              className="app__icon-btn"
              onClick={() => setInviteOpen(true)}
              aria-label="Invite someone"
              title="Invite someone"
            >
              <AppIcon name="party" size={19} />
            </button>
          )}
          <button
            className="app__icon-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            <AppIcon name="settings" size={19} />
          </button>
          <button
            className="app__signout"
            onClick={() => signOut.mutate()}
            title={me.email}
          >
            {me.picture && (
              <img
                className="app__avatar"
                src={me.picture}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}
            Sign out
          </button>
        </div>
      </header>

      {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
      {inviteOpen && <InviteSheet onClose={() => setInviteOpen(false)} />}

      <main className="app__main">
        {tab === "log" && <LogPage day={day} setDay={setDay} />}
        {tab === "guide" && <GuidePage />}
        {tab === "trends" && (
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <TrendsPage goToDay={goToDay} />
          </Suspense>
        )}
        {tab === "goals" && <GoalsPage />}
      </main>

      <nav className="tabbar">
        <button
          className={`tabbar__btn ${tab === "log" ? "is-active" : ""}`}
          onClick={() => setTab("log")}
        >
          <AppIcon name="log" size={22} className="tabbar__icon" />
          Log
        </button>
        <button
          className={`tabbar__btn ${tab === "trends" ? "is-active" : ""}`}
          onClick={() => setTab("trends")}
        >
          <AppIcon name="trends" size={22} className="tabbar__icon" />
          Trends
        </button>
        <button
          className={`tabbar__btn ${tab === "guide" ? "is-active" : ""}`}
          onClick={() => setTab("guide")}
        >
          <AppIcon name="guide" size={22} className="tabbar__icon" />
          Guide
        </button>
        <button
          className={`tabbar__btn ${tab === "goals" ? "is-active" : ""}`}
          onClick={() => setTab("goals")}
        >
          <AppIcon name="goals" size={22} className="tabbar__icon" />
          Goals
        </button>
      </nav>
    </div>
  );
}
