// Dismisses the boot splash that's baked into index.html. The splash paints on the first
// frame (before this bundle loads); App calls hideBootSplash() once /auth/me resolves.

const MIN_VISIBLE_MS = 400 // keep it up briefly so a fast/cached auth check doesn't strobe it
const REMOVE_AFTER_FADE_MS = 400 // > the 0.3s opacity transition, in case transitionend is missed

const start = performance.now()
let dismissed = false

export function hideBootSplash(): void {
  if (dismissed) return
  dismissed = true

  const remaining = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start))
  window.setTimeout(() => {
    const el = document.getElementById('boot-splash')
    if (!el) return
    el.classList.add('is-hidden')
    const remove = () => el.remove()
    el.addEventListener('transitionend', remove, { once: true })
    window.setTimeout(remove, REMOVE_AFTER_FADE_MS) // fallback if the transition never fires
  }, remaining)
}
