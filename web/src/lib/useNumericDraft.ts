import { useState } from 'react'

/**
 * Lets a numeric <input> hold a transient empty/partial string while focused, so the user can
 * clear the field and retype without it snapping back to a number on every keystroke. The
 * parent's committed value updates live as valid numbers are typed; clearing the field commits
 * nothing (the last value stays put), and on blur the display re-syncs to the committed value —
 * so an abandoned-empty field reverts rather than submitting a 0.
 *
 * `commit` only fires for finite, non-negative inputs, so a stray "-" never lands a negative.
 * An explicitly typed "0" still commits (legitimate for macros like fat); only an *empty* field
 * is treated as "no change".
 */
export function useNumericDraft(
  value: number,
  format: (n: number) => string,
  commit: (n: number) => void,
) {
  const [draft, setDraft] = useState<string | null>(null)
  return {
    /** Bind to the input's `value`. */
    text: draft ?? format(value),
    /** Call from the input's `onChange` with `e.target.value`. */
    onInput(raw: string) {
      setDraft(raw)
      if (raw === '') return // empty while editing — leave the committed value untouched
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) commit(n)
    },
    /** Call from the input's `onBlur` to re-sync the display to the committed value. */
    onBlur() {
      setDraft(null)
    },
    /** Drop the draft when the value is changed by a non-typing control (e.g. ± buttons). */
    reset() {
      setDraft(null)
    },
  }
}
