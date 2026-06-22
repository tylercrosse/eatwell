import { useRef } from 'react'
import { AppIcon } from './AppIcon'

interface Props {
  onPhoto: (file: File) => void
  disabled?: boolean
  cameraLabel?: string
  libraryLabel?: string
}

/**
 * Two affordances over one hidden file input:
 *   - "Take photo" uses capture="environment" -> opens the rear camera on iOS.
 *   - "Choose from library" omits capture -> photo library picker.
 * Chosen over getUserMedia: less plumbing and better behavior inside an installed PWA.
 */
export function PhotoCapture({
  onPhoto,
  disabled,
  cameraLabel = 'Take a photo',
  libraryLabel = 'Choose from library',
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onPhoto(file)
    e.target.value = '' // allow picking the same file again
  }

  return (
    <div className="photo-capture">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handle}
      />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={handle} />

      <button
        className="btn btn--primary btn--lg"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
      >
        <span className="icon-label">
          <AppIcon name="camera" size={18} />
          <span>{cameraLabel}</span>
        </span>
      </button>
      <button
        className="btn btn--ghost"
        disabled={disabled}
        onClick={() => libraryRef.current?.click()}
      >
        {libraryLabel}
      </button>
    </div>
  )
}
