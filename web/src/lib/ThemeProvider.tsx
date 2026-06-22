import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { usePersistentChoice, usePersistentToggle } from './prefs'
import {
  DARK_THEME_IDS,
  DEFAULT_SYSTEM_DARK,
  DEFAULT_THEME,
  SYSTEM_DARK_STORAGE_KEY,
  THEME_IDS,
  THEME_STORAGE_KEY,
  ThemeContext,
  applyResolvedTheme,
  type ResolvedTheme,
  type ThemeId,
} from './theme'
import {
  DEFAULT_TEXT_SIZE,
  TEXT_SIZE_IDS,
  TEXT_SIZE_STORAGE_KEY,
  applyTextSize,
  type TextSize,
} from './textSize'
import { DEFAULT_SIMPLE_VIEW, SIMPLE_VIEW_STORAGE_KEY } from './viewMode'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

function getSystemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark'
}

/** The OS light/dark preference, kept live via the media query (no setState-in-effect). */
function useSystemTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(LIGHT_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    getSystemTheme,
    () => 'dark', // SSR / no-matchMedia fallback
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = usePersistentChoice<ThemeId>(THEME_STORAGE_KEY, THEME_IDS, DEFAULT_THEME)
  const [systemDark, setSystemDark] = usePersistentChoice<ResolvedTheme>(
    SYSTEM_DARK_STORAGE_KEY,
    DARK_THEME_IDS,
    DEFAULT_SYSTEM_DARK,
  )
  const [textSize, setTextSize] = usePersistentChoice<TextSize>(
    TEXT_SIZE_STORAGE_KEY,
    TEXT_SIZE_IDS,
    DEFAULT_TEXT_SIZE,
  )
  const [simpleView, setSimpleView] = usePersistentToggle(SIMPLE_VIEW_STORAGE_KEY, DEFAULT_SIMPLE_VIEW)
  const system = useSystemTheme() // 'light' | 'dark' from the OS
  // `resolved` is derived during render: an explicit theme is itself; 'system' follows the OS,
  // using the chosen dark variant at night.
  const resolved: ResolvedTheme = theme !== 'system' ? theme : system === 'light' ? 'light' : systemDark

  useEffect(() => {
    applyResolvedTheme(resolved)
  }, [resolved])

  useEffect(() => {
    applyTextSize(textSize)
  }, [textSize])

  const value = useMemo(
    () => ({
      theme,
      resolved,
      setTheme,
      systemDark,
      setSystemDark,
      textSize,
      setTextSize,
      simpleView,
      setSimpleView,
    }),
    [theme, resolved, setTheme, systemDark, setSystemDark, textSize, setTextSize, simpleView, setSimpleView],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
