import { useEffect, useState } from 'react'

interface Props {
  previewUrl: string
  isClearDisabled?: boolean
  onClear: () => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.5

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

export function MenuPhotoPreview({ previewUrl, isClearDisabled = false, onClear }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [zoom, setZoom] = useState(MIN_ZOOM)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  function openViewer() {
    setZoom(MIN_ZOOM)
    setIsOpen(true)
  }

  function clearPhoto() {
    setIsOpen(false)
    onClear()
  }

  return (
    <>
      <div className="menu-photo">
        <button type="button" className="menu-photo__thumb" onClick={openViewer} aria-label="Zoom menu photo">
          <img src={previewUrl} alt="Menu scan preview" />
          <span className="menu-photo__thumb-action">Zoom photo</span>
        </button>
        <div className="menu-photo__actions">
          <button type="button" className="btn btn--ghost" onClick={openViewer}>
            Zoom photo
          </button>
          <button type="button" className="btn btn--ghost" disabled={isClearDisabled} onClick={clearPhoto}>
            Clear photo
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Menu photo zoom view">
          <div className="photo-viewer__bar">
            <div className="photo-viewer__title">
              <strong>Menu photo</strong>
              <span>Pinch or use the zoom controls.</span>
            </div>
            <button type="button" className="photo-viewer__close" aria-label="Close photo zoom" onClick={() => setIsOpen(false)}>
              x
            </button>
          </div>

          <div className="photo-viewer__controls" role="group" aria-label="Photo zoom controls">
            <button type="button" className="btn btn--ghost" onClick={() => setZoom(MIN_ZOOM)}>
              Fit
            </button>
            <button
              type="button"
              className="btn btn--icon"
              aria-label="Zoom out"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
            >
              -
            </button>
            <span className="photo-viewer__zoom">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn btn--icon"
              aria-label="Zoom in"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
            >
              +
            </button>
            <button type="button" className="btn btn--ghost" disabled={isClearDisabled} onClick={clearPhoto}>
              Clear
            </button>
          </div>

          <div className="photo-viewer__stage">
            <img
              className="photo-viewer__image"
              src={previewUrl}
              alt="Menu scan preview"
              draggable={false}
              style={{ width: `${zoom * 100}%` }}
            />
          </div>
        </div>
      )}
    </>
  )
}
