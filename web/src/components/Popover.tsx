import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface Props {
  /** The trigger content (a ring, a label, …). Wrapped in a button. */
  children: ReactNode
  /** What shows in the floating panel. */
  content: ReactNode
  /** Accessible name for the trigger + panel. */
  label: string
  placement?: 'top' | 'bottom'
}

/**
 * Minimal dependency-free popover. Tap/click toggles (mobile), hover opens it (desktop). Closes on
 * Escape or an outside pointerdown. The panel is a DOM child of the wrapper, so moving the cursor
 * from the trigger onto the panel doesn't fire mouseleave; a transparent CSS bridge covers the gap.
 */
export function Popover({ children, content, label, placement = 'top' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <span
      className="popover"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="popover__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label={label} className={`popover__panel popover__panel--${placement}`}>
          {content}
        </div>
      )}
    </span>
  )
}
