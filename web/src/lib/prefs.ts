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
