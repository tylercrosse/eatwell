import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogPage } from './pages/LogPage'
import { GuidePage } from './pages/GuidePage'
import { GoalsPage } from './pages/GoalsPage'
import { AppIcon } from './components/AppIcon'
import { LoginPage } from './components/LoginPage'
import { SettingsMenu } from './components/SettingsMenu'
import { getMe, loginWithGoogle, logout } from './api/auth'
import { ApiError } from './api/client'
import { localDayKey } from './lib/date'
import { hideBootSplash } from './lib/bootSplash'

// Lazy so the charting lib (recharts) is a separate chunk, off the initial load path.
const TrendsPage = lazy(() => import('./pages/TrendsPage').then((m) => ({ default: m.TrendsPage })))

type Tab = 'log' | 'guide' | 'trends' | 'goals'

export default function App() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('log')
  const [day, setDay] = useState<string>(localDayKey()) // the day the Log page is viewing
  const [loginError, setLoginError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 401 here just means "not signed in" — surface the login screen, don't retry.
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false })

  // Dismiss the index.html boot splash once auth resolves (signed in or 401).
  useEffect(() => {
    if (!meQuery.isLoading) hideBootSplash()
  }, [meQuery.isLoading])

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

  const onCredential = useCallback((credential: string) => login.mutate(credential), [login])
  // Jump to a specific day on the Log tab (used by the Trends charts).
  const goToDay = useCallback((d: string) => {
    setDay(d)
    setTab('log')
  }, [])

  // The index.html boot splash already covers the screen while auth resolves; render
  // nothing underneath so there's no flash of content as the splash fades out.
  if (meQuery.isLoading) return null

  const me = meQuery.data
  if (!me) {
    return <LoginPage onCredential={onCredential} error={loginError} pending={login.isPending} />
  }

  return (
    <div className="app">
      <header className="app__header app__header--row">
        <h1>Calorie Tracker</h1>
        <div className="app__header-actions">
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
