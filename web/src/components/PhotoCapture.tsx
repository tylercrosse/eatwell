import { useRef } from 'react'
import { AppIcon } from './AppIcon'

interface Props {
  onPhoto: (file: File) => void
  disabled?: boolean
  cameraLabel?: string
  libraryLabel?: string
}

function FileIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="capture-file-icon">
      <path
        d="M6.5 3.5h7.1l3.9 3.9v13.1h-11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path
        d="M8.7 16.8l2.6-3 1.8 2 1.1-1.2 2.7 2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="10.4" r="1" fill="currentColor" />
    </svg>
  )
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
        <span className="icon-label">
          <FileIcon size={18} />
          <span>{libraryLabel}</span>
        </span>
      </button>
    </div>
  )
}
