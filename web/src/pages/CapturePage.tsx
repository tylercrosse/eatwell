import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhotoCapture } from '../components/PhotoCapture'
import { EstimateCard, type Draft } from '../components/EstimateCard'
import { postEstimate } from '../api/estimate'
import { postEntry } from '../api/entries'
import { localDateTime, localDayKey } from '../lib/date'
import { ApiError } from '../api/client'
import type { AnalyzeResponse } from '../types'

type Status = 'idle' | 'uploading' | 'review' | 'done' | 'error'

interface Props {
  onLogged: () => void // switch to the log tab after saving
}

export function CapturePage({ onLogged }: Props) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)

  // Revoke the object URL when it changes or on unmount (avoid leaks).
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

  const estimate = useMutation({
    mutationFn: postEstimate,
    onMutate: () => {
      setError(null)
      setStatus('uploading')
    },
    onSuccess: (res) => {
      setResult(res)
      const a = res.analysis
      setDraft({
        food_name: a.items.map((i) => i.name).join(', ') || 'Meal',
        calories: a.total_calories,
        protein_g: a.total_protein_g,
        carbs_g: a.total_carbs_g,
        fat_g: a.total_fat_g,
        serving_size: a.serving_size_estimate,
      })
      setStatus('review')
    },
    onError: (e) => {
      setError(
        e instanceof ApiError && e.status === 502
          ? "Couldn't estimate this photo — the AI service had trouble. Try another shot."
          : e instanceof Error
            ? e.message
            : 'Something went wrong.',
      )
      setStatus('error')
    },
  })

  const save = useMutation({
    mutationFn: postEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', localDayKey()] })
      queryClient.invalidateQueries({ queryKey: ['summary', localDayKey()] })
      reset()
      onLogged()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save.'),
  })

  function reset() {
    setPreview(null)
    setDraft(null)
    setResult(null)
    setError(null)
    setStatus('idle')
  }

  function onPhoto(file: File) {
    setPreview(file)
    estimate.mutate(file)
  }

  function onConfirm() {
    if (!draft) return
    save.mutate({
      ...draft,
      confidence: result?.analysis.confidence ?? null,
      photo_ref: result?.photo_ref ?? null,
      items_json: result ? JSON.stringify(result.analysis.items) : null,
      source: 'ai',
      logged_at: localDateTime(),
    })
  }

  return (
    <div className="page">
      {status === 'idle' && (
        <div className="capture-intro">
          <h2>What did you eat?</h2>
          <p className="muted">Snap a photo and I'll estimate the calories and macros.</p>
          <PhotoCapture onPhoto={onPhoto} />
        </div>
      )}

      {status === 'uploading' && (
        <div className="capture-loading">
          {previewUrl && <img className="estimate__photo" src={previewUrl} alt="Food" />}
          <div className="spinner" />
          <p className="muted">Estimating nutrition…</p>
        </div>
      )}

      {status === 'review' && draft && (
        <EstimateCard
          draft={draft}
          confidence={result?.analysis.confidence ?? null}
          previewUrl={previewUrl}
          saving={save.isPending}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
          onConfirm={onConfirm}
          onCancel={reset}
        />
      )}

      {status === 'error' && (
        <div className="capture-error card">
          <p className="error-text">{error}</p>
          <button className="btn btn--primary" onClick={reset}>
            Try again
          </button>
        </div>
      )}

      {error && status === 'review' && <p className="error-text">{error}</p>}
    </div>
  )
}
