import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PhotoCapture } from '../components/PhotoCapture'
import { EstimateCard, type CaptureDraft, type ItemDraft } from '../components/EstimateCard'
import { clampServings, composeServingSize, parseServingSize } from '../lib/serving'
import { isBeverageForFullness } from '../lib/fullness'
import { postEstimate, postEstimateText } from '../api/estimate'
import { postEntries } from '../api/entries'
import { getBarcodeFood, getRecentFoods } from '../api/foods'
import { localDateTime, withDayKey } from '../lib/date'
import { mealFromTime } from '../lib/meals'
import { ApiError } from '../api/client'
import type { AnalysisResult, BarcodeFood, EntryCreate, FoodItem, Meal, RecentFood } from '../types'

// Lazy so the barcode-decoding lib (@zxing) is its own chunk, loaded only when scanning.
const BarcodeScanner = lazy(() =>
  import('../components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
)

type Status = 'idle' | 'scanning' | 'uploading' | 'review' | 'done' | 'error'

interface Props {
  day: string // new entries default to this day (the day being viewed)
  onLogged: () => void // called after a successful save (host closes the modal)
}

// Client-only id for React keys + merge selection; never sent to the backend.
let _idSeq = 0
const newId = () => `item-${_idSeq++}`

function itemFromFoodItem(it: FoodItem): ItemDraft {
  const isBeverage = isBeverageForFullness({
    name: it.name,
    calories: it.calories,
    protein_g: it.protein_g,
    fat_g: it.fat_g,
    fiber_g: it.fiber_g,
    weight_g: it.weight_g,
    is_beverage: it.is_beverage,
  })
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
    is_beverage: isBeverage,
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
  return { items, meal: mealFromTime(), logged_at: withDayKey(localDateTime(), day), source: 'ai' }
}

/** Prefill a single-item draft from a scanned packaged food (no AI call). */
function draftFromBarcode(food: BarcodeFood, day: string): CaptureDraft {
  const foodName = food.brand ? `${food.brand} ${food.name}` : food.name
  return {
    items: [
      {
        id: newId(),
        food_name: foodName,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        weight_g: food.weight_g ?? 0,
        fiber_g: food.fiber_g,
        sugar_g: food.sugar_g,
        sodium_mg: food.sodium_mg,
        is_beverage: isBeverageForFullness({ ...food, food_name: foodName }),
        serving_size: food.serving_size,
        servings: 1,
      },
    ],
    meal: mealFromTime(),
    logged_at: withDayKey(localDateTime(), day),
    source: 'barcode',
  }
}

/** Re-log a recent food: one item, no AI call. Restores the serving last used. */
function draftFromRecent(food: RecentFood, day: string): CaptureDraft {
  // Stored macros are the total (baseline × servings); divide the multiplier back out so the
  // editor shows the per-serving baseline with the remembered servings count restored.
  const { base, servings } = parseServingSize(food.serving_size ?? null)
  const s = servings > 0 ? servings : 1
  const per = (v: number | null | undefined) => (v ?? 0) / s
  return {
    items: [
      {
        id: newId(),
        food_name: food.food_name,
        calories: per(food.calories),
        protein_g: per(food.protein_g),
        carbs_g: per(food.carbs_g),
        fat_g: per(food.fat_g),
        weight_g: per(food.weight_g),
        fiber_g: per(food.fiber_g),
        sugar_g: per(food.sugar_g),
        sodium_mg: per(food.sodium_mg),
        is_beverage: isBeverageForFullness(food),
        serving_size: base,
        servings: clampServings(s),
      },
    ],
    meal: mealFromTime(),
    logged_at: withDayKey(localDateTime(), day),
    source: 'manual',
  }
}

/** Shared metadata applied to every entry of a capture (the per-item macros come from the draft). */
interface EntryMeta {
  meal: Meal
  logged_at: string
  confidence: number | null
  photoRef: string | null
  source: string
}

/** Convert one editable item-draft into an EntryCreate, scaling baseline macros by its servings. */
function itemToEntry(item: ItemDraft, meta: EntryMeta): EntryCreate {
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
    confidence: meta.confidence,
    photo_ref: meta.photoRef,
    source: meta.source,
    meal: meta.meal,
    logged_at: meta.logged_at,
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
  const [busyLabel, setBusyLabel] = useState('Estimating nutrition…')
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
      setBusyLabel('Estimating nutrition…')
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
      setBusyLabel('Estimating nutrition…')
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

  // Look up a scanned barcode, then drop the matched product into the review card.
  const barcodeLookup = useMutation({
    mutationFn: getBarcodeFood,
    onMutate: () => {
      setError(null)
      setPreview(null)
      setBusyLabel('Looking up barcode…')
      setStatus('uploading')
    },
    onSuccess: (food) => {
      setAnalysis(null)
      setPhotoRef(null)
      setDraft(draftFromBarcode(food, day))
      setStatus('review')
    },
    onError: (e) => {
      setError(
        e instanceof ApiError && e.status === 404
          ? "No product found for that barcode. Try a photo or describe it instead."
          : e instanceof ApiError && e.status === 400
            ? "That doesn't look like a product barcode."
            : e instanceof Error
              ? e.message
              : 'Barcode lookup failed.',
      )
      setStatus('error')
    },
  })

  const [recentSearch, setRecentSearch] = useState('')
  const [recentQ, setRecentQ] = useState('')
  // Debounce the search box so we refetch once the user pauses, not on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setRecentQ(recentSearch), 250)
    return () => clearTimeout(id)
  }, [recentSearch])

  const trimmedQ = recentQ.trim()
  const recentQuery = useQuery({
    queryKey: ['foods', 'recent', trimmedQ],
    // Frecency keeps daily staples near the top; a wider limit when searching surfaces older foods.
    queryFn: () => getRecentFoods(trimmedQ || undefined, 'frecency', trimmedQ ? 30 : 15),
    placeholderData: keepPreviousData, // keep the prior list visible while typing
  })

  const save = useMutation({
    mutationFn: postEntries,
    onSuccess: () => {
      // Entries may be logged for any day (not just today) — refresh all day lists + trends.
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['entries-range'] })
      queryClient.invalidateQueries({ queryKey: ['trends-history'] })
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

  function startScan() {
    setError(null)
    setStatus('scanning')
  }
  const onBarcode = (code: string) => barcodeLookup.mutate(code)

  // Re-log a recent food without an AI call: jump straight to the review card.
  function onPickRecent(food: RecentFood) {
    setError(null)
    setPreview(null)
    setAnalysis(null)
    setPhotoRef(null)
    setDraft(draftFromRecent(food, day))
    setStatus('review')
  }

  // Quick-add a recent food straight to the viewed day — no review card, remembered serving.
  function onQuickAdd(food: RecentFood) {
    setError(null)
    const d = draftFromRecent(food, day)
    const entry = itemToEntry(d.items[0], {
      meal: d.meal,
      logged_at: d.logged_at,
      confidence: null,
      photoRef: null,
      source: 'manual',
    })
    save.mutate([entry])
  }

  const patchItem = (id: string, patch: Partial<ItemDraft>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : d))
  const removeItem = (id: string) =>
    setDraft((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d))
  const merge = (ids: string[]) => setDraft((d) => (d ? { ...d, items: mergeItems(d.items, ids) } : d))

  function onConfirm() {
    if (!draft || draft.items.length === 0) return
    const meta: EntryMeta = {
      meal: draft.meal,
      logged_at: draft.logged_at, // user may have backdated this in the card
      confidence: analysis?.confidence ?? null,
      photoRef, // the split entries share the one capture photo
      source: draft.source ?? (analysis ? 'ai' : 'manual'), // ai | manual | barcode
    }
    save.mutate(draft.items.map((item) => itemToEntry(item, meta)))
  }

  const recentFoods = recentQuery.data ?? []
  const searchActive = recentSearch.trim().length > 0
  // Show the section (with its search box) whenever there's history or an active search — so an
  // empty search result still leaves the box on screen to edit, rather than hiding it.
  const showRecent = recentFoods.length > 0 || searchActive

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

          <button type="button" className="btn btn--ghost capture-scan" onClick={startScan}>
            <svg className="capture-scan__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <g fill="currentColor">
                <rect x="2" y="5" width="1.6" height="14" />
                <rect x="5" y="5" width="2.6" height="14" />
                <rect x="9" y="5" width="1.4" height="14" />
                <rect x="12" y="5" width="2.6" height="14" />
                <rect x="16" y="5" width="1.4" height="14" />
                <rect x="19" y="5" width="2.6" height="14" />
              </g>
            </svg>
            Scan a barcode
          </button>

          {showRecent && (
            <div className="capture-recent">
              <span className="capture-recent__title">Your foods — tap to re-log, ✓ to quick-add</span>
              <input
                type="text"
                className="capture-recent__search"
                value={recentSearch}
                placeholder="Search your foods…"
                onChange={(e) => setRecentSearch(e.target.value)}
              />
              <div className="capture-recent__list">
                {recentFoods.map((food) => {
                  const times = food.times_logged ?? 0
                  return (
                    <div key={food.food_name} className="recent-chip">
                      <button type="button" className="recent-chip__main" onClick={() => onPickRecent(food)}>
                        <span className="recent-chip__name">{food.food_name}</span>
                        <span className="recent-chip__meta">
                          {times > 1 && (
                            <span className="recent-chip__freq" title={`Logged ${times} times`}>
                              ↻ {times}×
                            </span>
                          )}
                          <span>{Math.round(food.protein_g)} g protein</span>
                        </span>
                      </button>
                      <span className="recent-chip__cal">{Math.round(food.calories)} kcal</span>
                      <button
                        type="button"
                        className="recent-chip__quick"
                        title="Quick-add to this day"
                        aria-label={`Quick-add ${food.food_name}`}
                        disabled={save.isPending}
                        onClick={() => onQuickAdd(food)}
                      >
                        ✓
                      </button>
                    </div>
                  )
                })}
                {recentFoods.length === 0 && searchActive && !recentQuery.isLoading && (
                  <span className="capture-recent__empty">No matches for “{recentSearch.trim()}”.</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'scanning' && (
        <Suspense
          fallback={
            <div className="capture-loading">
              <div className="spinner" />
              <p className="muted">Starting scanner…</p>
            </div>
          }
        >
          <BarcodeScanner onDetected={onBarcode} onCancel={reset} />
        </Suspense>
      )}

      {status === 'uploading' && (
        <div className="capture-loading">
          {previewUrl && <img className="estimate__photo" src={previewUrl} alt="Food" />}
          <div className="spinner" />
          <p className="muted">{busyLabel}</p>
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
