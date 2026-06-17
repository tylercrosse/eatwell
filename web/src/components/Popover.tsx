import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

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
  const [actualPlacement, setActualPlacement] = useState(placement)
  const [panelShiftX, setPanelShiftX] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hoverOpenedRef = useRef(false)
  const panelId = useId()

  function show() {
    setActualPlacement(placement)
    setPanelShiftX(0)
    setOpen(true)
  }

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

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !ref.current) return

    const edgeGap = 12
    const panel = panelRef.current
    const panelRect = panel.getBoundingClientRect()
    const anchorRect = ref.current.getBoundingClientRect()
    const unshiftedLeft = panelRect.left - panelShiftX
    const unshiftedRight = panelRect.right - panelShiftX

    let nextShiftX = 0
    if (unshiftedLeft < edgeGap) nextShiftX = edgeGap - unshiftedLeft
    else if (unshiftedRight > window.innerWidth - edgeGap) nextShiftX = window.innerWidth - edgeGap - unshiftedRight
    if (Math.abs(nextShiftX - panelShiftX) > 0.5) setPanelShiftX(Math.round(nextShiftX))

    const spaceAbove = anchorRect.top - edgeGap
    const spaceBelow = window.innerHeight - anchorRect.bottom - edgeGap
    if (actualPlacement === 'top' && panelRect.top < edgeGap && spaceBelow > spaceAbove) {
      setActualPlacement('bottom')
    } else if (actualPlacement === 'bottom' && panelRect.bottom > window.innerHeight - edgeGap && spaceAbove > spaceBelow) {
      setActualPlacement('top')
    }
  }, [actualPlacement, open, panelShiftX])

  return (
    <span
      className="popover"
      ref={ref}
      onMouseEnter={() => {
        hoverOpenedRef.current = true
        show()
      }}
      onMouseLeave={() => {
        hoverOpenedRef.current = false
        setOpen(false)
      }}
    >
      <button
        type="button"
        className="popover__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={(event) => {
          if (hoverOpenedRef.current && event.detail > 0) return
          if (open) setOpen(false)
          else show()
        }}
      >
        {children}
      </button>
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className={`popover__panel popover__panel--${actualPlacement}`}
          style={{ '--popover-shift-x': `${panelShiftX}px` } as CSSProperties}
        >
          {content}
        </div>
      )}
    </span>
  )
}
