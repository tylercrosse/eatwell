import { useState } from 'react'

function load(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v === '1'
  } catch {
    return fallback // storage unavailable (private mode etc.)
  }
}

/** A boolean preference persisted to localStorage. */
export function usePersistentToggle(key: string, fallback = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => load(key, fallback))
  const set = (next: boolean) => {
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // ignore; preference just won't persist
    }
    setValue(next)
  }
  return [value, set]
}

function loadChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v != null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback // storage unavailable (private mode etc.)
  }
}

/** A string-enum preference persisted to localStorage. Unknown/stale values fall back. */
export function usePersistentChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => loadChoice(key, allowed, fallback))
  const set = (next: T) => {
    try {
      localStorage.setItem(key, next)
    } catch {
      // ignore; preference just won't persist
    }
    setValue(next)
  }
  return [value, set]
}
