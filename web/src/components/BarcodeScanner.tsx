import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

interface Props {
  onDetected: (code: string) => void // fires once, with the decoded barcode digits
  onCancel: () => void
}

// Retail 1D formats only — UPC covers US groceries, EAN the rest of the world. Restricting
// the format set speeds decoding and avoids spurious QR/Code-128 reads on packaging.
const FORMATS = [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]

const digitsOf = (s: string) => s.replace(/\D/g, '')

/**
 * Live barcode scanner over the rear camera (@zxing/browser). Reports the first decode and
 * stops the stream. Falls back to manual numeric entry when the camera is denied/unavailable
 * (and as a path for hand-keying a code), so the feature still works without camera access.
 */
export function BarcodeScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  // Keep the latest onDetected without restarting the camera when the parent re-renders.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, FORMATS]])
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 })
    let controls: IScannerControls | null = null
    let done = false // latch: emit only the first decode, ignore the continuous callback after

    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current!, (result) => {
        if (result && !done) {
          done = true
          controls?.stop()
          onDetectedRef.current(result.getText())
        }
      })
      .then((c) => {
        controls = c
        if (done) c.stop() // a decode (or unmount) beat the camera coming up
      })
      .catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it, or type the barcode below.'
            : name === 'NotFoundError'
              ? 'No camera found. Type the barcode below instead.'
              : 'Could not start the camera. Type the barcode below instead.',
        )
      })

    return () => {
      done = true
      controls?.stop()
    }
  }, [])

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const code = digitsOf(manual)
    if (code.length >= 8) onDetected(code)
  }

  return (
    <div className="scanner">
      {!error && (
        <div className="scanner__viewport">
          <video ref={videoRef} className="scanner__video" muted playsInline />
          <div className="scanner__reticle" />
        </div>
      )}

      <p className="muted scanner__hint">{error ?? 'Point the rear camera at a product barcode.'}</p>

      <form className="scanner__manual" onSubmit={submitManual}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={manual}
          placeholder="Or type the barcode number"
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={digitsOf(manual).length < 8}>
          Look up
        </button>
      </form>

      <button className="btn btn--ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
