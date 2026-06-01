import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PhotoCapture } from '../components/PhotoCapture'
import { EstimateCard, type Draft } from '../components/EstimateCard'
import { composeServingSize, parseServingSize } from '../lib/serving'
import { postEstimate, postEstimateText } from '../api/estimate'
import { postEntry } from '../api/entries'
import { getRecentFoods } from '../api/foods'
import { localDateTime, localDayKey } from '../lib/date'
import { mealFromTime } from '../lib/meals'
import { ApiError } from '../api/client'
import type { AnalysisResult, RecentFood } from '../types'

type Status = 'idle' | 'uploading' | 'review' | 'done' | 'error'

interface Props {
  onLogged: () => void // switch to the log tab after saving
}

/** Build the editable, one-serving-baseline draft shown in the review card. */
function draftFromAnalysis(a: AnalysisResult): Draft {
  return {
    food_name: a.items.map((i) => i.name).join(', ') || 'Meal',
    calories: a.total_calories,
    protein_g: a.total_protein_g,
    carbs_g: a.total_carbs_g,
    fat_g: a.total_fat_g,
    weight_g: a.total_weight_g ?? 0,
    fiber_g: a.total_fiber_g ?? 0,
    sugar_g: a.total_sugar_g ?? 0,
    sodium_mg: a.total_sodium_mg ?? 0,
    serving_size: a.serving_size_estimate,
    servings: 1,
    meal: mealFromTime(), // default from the current time; user can override in the card
    logged_at: localDateTime(), // defaults to now; date editable in the card
  }
}

/** Re-log a recent food: prefill the card from a stored entry, no AI call. */
function draftFromRecent(food: RecentFood): Draft {
  const { base } = parseServingSize(food.serving_size ?? null) // strip any "2×" so servings starts at 1
  return {
    food_name: food.food_name,
    calories: food.calories,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
    weight_g: food.weight_g ?? 0,
    fiber_g: food.fiber_g ?? 0,
    sugar_g: food.sugar_g ?? 0,
    sodium_mg: food.sodium_mg ?? 0,
    serving_size: base,
    servings: 1,
    meal: mealFromTime(),
    logged_at: localDateTime(),
  }
}

export function CapturePage({ onLogged }: Props) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [photoRef, setPhotoRef] = useState<string | null>(null)
  const [description, setDescription] = useState('')
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

  function onEstimateError(e: unknown) {
    setError(
      e instanceof ApiError && e.status === 502
        ? "Couldn't estimate that — the AI service had trouble. Try again."
        : e instanceof Error
          ? e.message
          : 'Something went wrong.',
    )
    setStatus('error')
  }

  const estimate = useMutation({
    mutationFn: postEstimate,
    onMutate: () => {
      setError(null)
      setStatus('uploading')
    },
    onSuccess: (res) => {
      setAnalysis(res.analysis)
      setPhotoRef(res.photo_ref)
      setDraft(draftFromAnalysis(res.analysis))
      setStatus('review')
    },
    onError: onEstimateError,
  })

  const estimateText = useMutation({
    mutationFn: postEstimateText,
    onMutate: () => {
      setError(null)
      setPreview(null)
      setStatus('uploading')
    },
    onSuccess: (res) => {
      setAnalysis(res)
      setPhotoRef(null)
      setDraft(draftFromAnalysis(res))
      setStatus('review')
    },
    onError: onEstimateError,
  })

  const recentQuery = useQuery({ queryKey: ['foods', 'recent'], queryFn: () => getRecentFoods() })

  const save = useMutation({
    mutationFn: postEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', localDayKey()] })
      queryClient.invalidateQueries({ queryKey: ['summary', localDayKey()] })
      queryClient.invalidateQueries({ queryKey: ['foods', 'recent'] })
      reset()
      onLogged()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save.'),
  })

  function reset() {
    setPreview(null)
    setDraft(null)
    setAnalysis(null)
    setPhotoRef(null)
    setDescription('')
    setError(null)
    setStatus('idle')
  }

  function onPhoto(file: File) {
    setPreview(file)
    estimate.mutate(file)
  }

  function onDescribe(e: React.FormEvent) {
    e.preventDefault()
    const desc = description.trim()
    if (desc) estimateText.mutate(desc)
  }

  // Re-log a recent food without an AI call: jump straight to the review card.
  function onPickRecent(food: RecentFood) {
    setError(null)
    setPreview(null)
    setAnalysis(null)
    setPhotoRef(null)
    setDraft(draftFromRecent(food))
    setStatus('review')
  }

  function onConfirm() {
    if (!draft) return
    const f = draft.servings // baseline macros scaled by the chosen quantity
    const scaledOrNull = (v: number) => (v > 0 ? v * f : null) // keep unset detail fields null
    save.mutate({
      food_name: draft.food_name,
      calories: draft.calories * f,
      protein_g: draft.protein_g * f,
      carbs_g: draft.carbs_g * f,
      fat_g: draft.fat_g * f,
      weight_g: scaledOrNull(draft.weight_g),
      fiber_g: scaledOrNull(draft.fiber_g),
      sugar_g: scaledOrNull(draft.sugar_g),
      sodium_mg: scaledOrNull(draft.sodium_mg),
      serving_size: composeServingSize(draft.serving_size, draft.servings),
      confidence: analysis?.confidence ?? null,
      photo_ref: photoRef,
      items_json: analysis ? JSON.stringify(analysis.items) : null,
      source: analysis ? 'ai' : 'manual', // recent re-logs have no fresh analysis
      meal: draft.meal,
      logged_at: draft.logged_at, // user may have backdated this in the card
    })
  }

  return (
    <div className="page">
      {status === 'idle' && (
        <div className="capture-intro">
          <h2>What did you eat?</h2>
          <p className="muted">Snap a photo and I'll estimate the calories and macros.</p>
          <PhotoCapture onPhoto={onPhoto} />

          <div className="capture-or">or</div>

          <form className="capture-text" onSubmit={onDescribe}>
            <input
              type="text"
              value={description}
              placeholder="Describe it — e.g. 12 oz iced latte"
              onChange={(e) => setDescription(e.target.value)}
            />
            <button className="btn btn--primary" type="submit" disabled={!description.trim()}>
              Estimate from description
            </button>
          </form>

          {(recentQuery.data?.length ?? 0) > 0 && (
            <div className="capture-recent">
              <span className="capture-recent__title">Recent — tap to re-log</span>
              <div className="capture-recent__list">
                {recentQuery.data!.map((food) => (
                  <button
                    key={food.food_name}
                    type="button"
                    className="recent-chip"
                    onClick={() => onPickRecent(food)}
                  >
                    <span className="recent-chip__name">{food.food_name}</span>
                    <span className="recent-chip__cal">{Math.round(food.calories)} kcal</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          confidence={analysis?.confidence ?? null}
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
