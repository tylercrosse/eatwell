import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PhotoCapture } from '../components/PhotoCapture'
import { EstimateCard, type CaptureDraft, type ItemDraft } from '../components/EstimateCard'
import { composeServingSize, parseServingSize } from '../lib/serving'
import { postEstimate, postEstimateText } from '../api/estimate'
import { postEntries } from '../api/entries'
import { getRecentFoods } from '../api/foods'
import { localDateTime, withDayKey } from '../lib/date'
import { mealFromTime } from '../lib/meals'
import { ApiError } from '../api/client'
import type { AnalysisResult, EntryCreate, FoodItem, RecentFood } from '../types'

type Status = 'idle' | 'uploading' | 'review' | 'done' | 'error'

interface Props {
  day: string // new entries default to this day (the day being viewed)
  onLogged: () => void // called after a successful save (host closes the modal)
}

// Client-only id for React keys + merge selection; never sent to the backend.
let _idSeq = 0
const newId = () => `item-${_idSeq++}`

function itemFromFoodItem(it: FoodItem): ItemDraft {
  return {
    id: newId(),
    food_name: it.name,
    calories: it.calories,
    protein_g: it.protein_g,
    carbs_g: it.carbs_g,
    fat_g: it.fat_g,
    weight_g: it.weight_g ?? 0,
    fiber_g: it.fiber_g ?? 0,
    sugar_g: it.sugar_g ?? 0,
    sodium_mg: it.sodium_mg ?? 0,
    is_beverage: it.is_beverage ?? false,
    serving_size: '',
    servings: 1,
  }
}

/** One editable item-draft per detected food; falls back to a single item from the totals. */
function draftFromAnalysis(a: AnalysisResult, day: string): CaptureDraft {
  const items: ItemDraft[] =
    a.items.length > 0
      ? a.items.map(itemFromFoodItem)
      : [
          {
            id: newId(),
            food_name: 'Meal',
            calories: a.total_calories,
            protein_g: a.total_protein_g,
            carbs_g: a.total_carbs_g,
            fat_g: a.total_fat_g,
            weight_g: a.total_weight_g ?? 0,
            fiber_g: a.total_fiber_g ?? 0,
            sugar_g: a.total_sugar_g ?? 0,
            sodium_mg: a.total_sodium_mg ?? 0,
            is_beverage: a.is_beverage ?? false,
            serving_size: a.serving_size_estimate,
            servings: 1,
          },
        ]
  // A lone item inherits the overall serving estimate; multi-item rows start without one.
  if (items.length === 1 && !items[0].serving_size) items[0].serving_size = a.serving_size_estimate
  return { items, meal: mealFromTime(), logged_at: withDayKey(localDateTime(), day) }
}

/** Re-log a recent food: one item, no AI call. */
function draftFromRecent(food: RecentFood, day: string): CaptureDraft {
  const { base } = parseServingSize(food.serving_size ?? null) // strip any "2×" so servings starts at 1
  return {
    items: [
      {
        id: newId(),
        food_name: food.food_name,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        weight_g: food.weight_g ?? 0,
        fiber_g: food.fiber_g ?? 0,
        sugar_g: food.sugar_g ?? 0,
        sodium_mg: food.sodium_mg ?? 0,
        is_beverage: food.is_beverage ?? false,
        serving_size: base,
        servings: 1,
      },
    ],
    meal: mealFromTime(),
    logged_at: withDayKey(localDateTime(), day),
  }
}

type MacroKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'weight_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg'

/** Merge the selected items into one composite (sums scaled macros; drink only if all are). */
function mergeItems(items: ItemDraft[], ids: string[]): ItemDraft[] {
  const idSet = new Set(ids)
  const chosen = items.filter((i) => idSet.has(i.id))
  if (chosen.length < 2) return items
  const sum = (k: MacroKey) => chosen.reduce((acc, i) => acc + i[k] * i.servings, 0)
  const merged: ItemDraft = {
    id: newId(),
    food_name: chosen.map((i) => i.food_name).filter(Boolean).join(' + ') || 'Combined',
    calories: sum('calories'),
    protein_g: sum('protein_g'),
    carbs_g: sum('carbs_g'),
    fat_g: sum('fat_g'),
    weight_g: sum('weight_g'),
    fiber_g: sum('fiber_g'),
    sugar_g: sum('sugar_g'),
    sodium_mg: sum('sodium_mg'),
    is_beverage: chosen.every((i) => i.is_beverage),
    serving_size: '',
    servings: 1,
  }
  // Insert the merged item where the first selected one was; drop the rest.
  const out: ItemDraft[] = []
  let inserted = false
  for (const i of items) {
    if (idSet.has(i.id)) {
      if (!inserted) {
        out.push(merged)
        inserted = true
      }
    } else {
      out.push(i)
    }
  }
  return out
}

export function CapturePage({ day, onLogged }: Props) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
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
      setDraft(draftFromAnalysis(res.analysis, day))
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
      setDraft(draftFromAnalysis(res, day))
      setStatus('review')
    },
    onError: onEstimateError,
  })

  const recentQuery = useQuery({ queryKey: ['foods', 'recent'], queryFn: () => getRecentFoods() })

  const save = useMutation({
    mutationFn: postEntries,
    onSuccess: () => {
      // Entries may be logged for any day (not just today) — refresh all day lists + trends.
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['entries-range'] })
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
    setDraft(draftFromRecent(food, day))
    setStatus('review')
  }

  const patchItem = (id: string, patch: Partial<ItemDraft>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : d))
  const removeItem = (id: string) =>
    setDraft((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d))
  const merge = (ids: string[]) => setDraft((d) => (d ? { ...d, items: mergeItems(d.items, ids) } : d))

  function onConfirm() {
    if (!draft || draft.items.length === 0) return
    const entries: EntryCreate[] = draft.items.map((item) => {
      const f = item.servings // baseline macros scaled by the chosen quantity
      const scaledOrNull = (v: number) => (v > 0 ? v * f : null) // keep unset detail fields null
      return {
        food_name: item.food_name,
        calories: item.calories * f,
        protein_g: item.protein_g * f,
        carbs_g: item.carbs_g * f,
        fat_g: item.fat_g * f,
        weight_g: scaledOrNull(item.weight_g),
        fiber_g: scaledOrNull(item.fiber_g),
        sugar_g: scaledOrNull(item.sugar_g),
        sodium_mg: scaledOrNull(item.sodium_mg),
        is_beverage: item.is_beverage,
        serving_size: composeServingSize(item.serving_size, item.servings),
        confidence: analysis?.confidence ?? null,
        photo_ref: photoRef, // the split entries share the one capture photo
        source: analysis ? 'ai' : 'manual', // recent re-logs have no fresh analysis
        meal: draft.meal,
        logged_at: draft.logged_at, // user may have backdated this in the card
      }
    })
    save.mutate(entries)
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
          onChangeItem={patchItem}
          onRemoveItem={removeItem}
          onMerge={merge}
          onChangeMeal={(meal) => setDraft((d) => (d ? { ...d, meal } : d))}
          onChangeDate={(logged_at) => setDraft((d) => (d ? { ...d, logged_at } : d))}
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
