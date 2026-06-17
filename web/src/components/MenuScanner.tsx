import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { postAnalyzeMenu } from '../api/estimate'
import { ApiError } from '../api/client'
import {
  choiceConfidenceCopy,
  choicesFromMenuResult,
  rankFoodChoices,
  sortScoredFoodChoices,
  type ChoiceGoal,
  type ChoiceSort,
} from '../lib/choiceScan'
import { PhotoCapture } from './PhotoCapture'
import { ChoiceScanResults } from './ChoiceScanResults'
import { MenuPhotoPreview } from './MenuPhotoPreview'

const CONF_CLASS = {
  high: 'conf--high',
  medium: 'conf--med',
  low: 'conf--low',
} as const

interface Props {
  goal: ChoiceGoal
}

function menuErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 502) return "Couldn't scan that menu — the AI service had trouble."
  if (e instanceof ApiError && e.status === 422) return "That doesn't look like a readable menu image."
  return e instanceof Error ? e.message : 'Menu scan failed.'
}

export function MenuScanner({ goal }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<Awaited<ReturnType<typeof postAnalyzeMenu>> | null>(null)
  const [scanError, setScanError] = useState<unknown>(null)
  const [sort, setSort] = useState<ChoiceSort>('recommended')
  const previewRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  function setPreview(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = file ? URL.createObjectURL(file) : null
    previewRef.current = url
    setPreviewUrl(url)
  }

  const scan = useMutation({
    mutationFn: ({ file }: { file: File; requestId: number }) => postAnalyzeMenu(file),
    onSuccess: (data, variables) => {
      if (variables.requestId !== requestIdRef.current) return
      setScanResult(data)
      setScanError(null)
    },
    onError: (error, variables) => {
      if (variables.requestId !== requestIdRef.current) return
      setScanResult(null)
      setScanError(error)
    },
  })

  function onPhoto(file: File) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setPreview(file)
    setScanResult(null)
    setScanError(null)
    setSort('recommended')
    scan.reset()
    scan.mutate({ file, requestId })
  }

  function clearResults() {
    requestIdRef.current += 1
    setPreview(null)
    setScanResult(null)
    setScanError(null)
    setSort('recommended')
    scan.reset()
  }

  const scoredChoices = useMemo(() => {
    if (!scanResult) return []
    return rankFoodChoices(choicesFromMenuResult(scanResult), goal)
  }, [scanResult, goal])
  const sortedChoices = useMemo(() => sortScoredFoodChoices(scoredChoices, sort), [scoredChoices, sort])
  const confidence = choiceConfidenceCopy(scanResult?.confidence)

  return (
    <section className="card menu-scanner">
      <div className="guide-section__head">
        <div>
          <span className="guide-eyebrow">Menu scanner</span>
          <h2>Compare a menu photo</h2>
          <p className="guide-section__sub">Rank visible options by your goal, protein, fiber, calories, and staying power.</p>
        </div>
      </div>

      {!scanResult && !scan.isPending && (
        <PhotoCapture
          onPhoto={onPhoto}
          disabled={scan.isPending}
          cameraLabel="📷 Take menu photo"
          libraryLabel="Choose menu photo"
        />
      )}

      {previewUrl && <MenuPhotoPreview previewUrl={previewUrl} onClear={clearResults} />}

      {scan.isPending && (
        <div className="capture-loading menu-scanner__loading">
          <div className="spinner" />
          <p className="muted">Scanning menu...</p>
        </div>
      )}

      {Boolean(scanError) && (
        <div className="menu-scanner__error">
          <p className="error-text">{menuErrorMessage(scanError)}</p>
          <button type="button" className="btn btn--ghost" onClick={clearResults}>
            Try another photo
          </button>
        </div>
      )}

      {scanResult && (
        <div className="menu-scanner__results">
          <div className="menu-scanner__results-head">
            <div>
              <h3>{scanResult.restaurant_name || 'Menu results'}</h3>
              <p>
                {scanResult.options.length} options found. Restaurant estimates are approximate and best used for
                comparison.
              </p>
            </div>
            {confidence && confidence.tone !== 'high' && (
              <span className={`conf menu-scanner__conf ${CONF_CLASS[confidence.tone]}`}>
                {confidence.label}
              </span>
            )}
          </div>
          {scoredChoices.length > 1 && (
            <div className="menu-scanner__controls">
              <label className="menu-scanner__sort">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as ChoiceSort)}>
                  <option value="recommended">Recommended</option>
                  <option value="menu">Menu order</option>
                  <option value="calories">Calories, low first</option>
                  <option value="protein">Protein, high first</option>
                  <option value="fiber">Fiber, high first</option>
                  <option value="stayingPower">Staying power, high first</option>
                </select>
              </label>
            </div>
          )}
          <ChoiceScanResults
            items={sortedChoices}
            emptyText="No clear orderable options found. Try a sharper, closer menu photo."
          />
          <button type="button" className="btn btn--ghost menu-scanner__reset" onClick={clearResults}>
            Scan another menu
          </button>
        </div>
      )}
    </section>
  )
}
