import { useEffect, type ReactNode } from 'react'

interface Props {
  title?: string
  onClose: () => void
  children: ReactNode
}

/** Lightweight modal sheet: dim overlay, optional title, close button, Esc to dismiss. */
export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          {title ? <h2 className="modal__title">{title}</h2> : <span />}
          <button className="modal__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
