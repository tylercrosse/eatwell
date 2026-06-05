import { useState } from 'react'
import { MacroInput } from './MacroInput'
import { FullnessBadge } from './FullnessBadge'
import { ServingsStepper } from './ServingsStepper'
import { round } from '../lib/totals'
import { MEAL_LABELS, MEAL_ORDER } from '../lib/meals'
import { dayKeyOf, localDayKey, withDayKey } from '../lib/date'
import type { Meal } from '../types'

/** One detected food/drink. Macros are the baseline for ONE serving; saved values are these
 *  scaled by `servings`. `id` is client-only (React keys + merge selection); never sent. */
export interface ItemDraft {
  id: string
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g: number // edible weight (powers the fullness badge); 0 = unknown
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  is_beverage: boolean // a drink (caps fullness; weight counts as drink volume, not food bulk)
  serving_size: string // free-text label describing a single serving
  servings: number // quantity multiplier applied to the baseline macros
}

/** A capture under review: its items plus the meal + date they'll all be logged under. */
export interface CaptureDraft {
  items: ItemDraft[]
  meal: Meal
  logged_at: string // local datetime; the date is editable (to backfill a past day)
}

interface Props {
  draft: CaptureDraft
  confidence: number | null
  previewUrl: string | null
  saving: boolean
  onChangeItem: (id: string, patch: Partial<ItemDraft>) => void
  onRemoveItem: (id: string) => void
  onMerge: (ids: string[]) => void
  onChangeMeal: (meal: Meal) => void
  onChangeDate: (logged_at: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function confidenceLabel(c: number): { text: string; cls: string } {
  if (c >= 0.66) return { text: 'High confidence', cls: 'conf--high' }
  if (c >= 0.33) return { text: 'Medium confidence', cls: 'conf--med' }
  return { text: 'Low confidence — double-check', cls: 'conf--low' }
}

interface ItemEditorProps {
  item: ItemDraft
  single: boolean // the only item — hide the merge checkbox/remove, expand by default
  selected: boolean
  onToggleSelect: () => void
  onChange: (patch: Partial<ItemDraft>) => void
  onRemove: () => void
}

/** A collapsible per-item row: name + a fullness/macro summary, expanding to the full editor. */
function ItemEditor({ item, single, selected, onToggleSelect, onChange, onRemove }: ItemEditorProps) {
  const [open, setOpen] = useState(single)
  const f = item.servings // ServingsStepper clamps > 0, so safe to divide by

  return (
    <div className="item-edit">
      <div className="item-edit__head">
        {!single && (
          <input
            type="checkbox"
            className="item-edit__select"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${item.food_name || 'item'} to combine`}
          />
        )}
        <input
          className="item-edit__name"
          type="text"
          value={item.food_name}
          placeholder="Item name"
          onChange={(e) => onChange({ food_name: e.target.value })}
        />
        <button
          type="button"
          className="item-edit__btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Done' : 'Edit'}
        </button>
        {!single && (
          <button type="button" className="item-edit__btn item-edit__remove" onClick={onRemove} aria-label="Remove item">
            ×
          </button>
        )}
      </div>

      <div className="item-edit__summary">
        <span>
          {round(item.calories * f)} kcal · P {round(item.protein_g * f)} · C {round(item.carbs_g * f)} · F{' '}
          {round(item.fat_g * f)}
        </span>
        <FullnessBadge food={item} variant="compact" />
        <label className="estimate__beverage">
          <input type="checkbox" checked={item.is_beverage} onChange={(e) => onChange({ is_beverage: e.target.checked })} />
          Drink
        </label>
      </div>

      {open && (
        <div className="item-edit__detail">
          <label className="field">
            <span className="field__label">Serving</span>
            <input
              type="text"
              value={item.serving_size}
              placeholder="e.g. 1 bowl (~300g)"
              onChange={(e) => onChange({ serving_size: e.target.value })}
            />
          </label>

          <ServingsStepper value={item.servings} onChange={(v) => onChange({ servings: v })} />

          <div className="macros">
            <MacroInput label="Calories" unit="kcal" value={item.calories * f} onChange={(v) => onChange({ calories: v / f })} />
            <MacroInput label="Protein" unit="g" value={item.protein_g * f} onChange={(v) => onChange({ protein_g: v / f })} />
            <MacroInput label="Carbs" unit="g" value={item.carbs_g * f} onChange={(v) => onChange({ carbs_g: v / f })} />
            <MacroInput label="Fat" unit="g" value={item.fat_g * f} onChange={(v) => onChange({ fat_g: v / f })} />
          </div>

          <div className="macros">
            <MacroInput label="Weight" unit="g" value={item.weight_g * f} onChange={(v) => onChange({ weight_g: v / f })} />
            <MacroInput label="Fiber" unit="g" value={item.fiber_g * f} onChange={(v) => onChange({ fiber_g: v / f })} />
            <MacroInput label="Sugar" unit="g" value={item.sugar_g * f} onChange={(v) => onChange({ sugar_g: v / f })} />
            <MacroInput label="Sodium" unit="mg" value={item.sodium_mg * f} onChange={(v) => onChange({ sodium_mg: v / f })} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Review + edit the AI estimate before committing it. A multi-food capture shows one row per
 *  detected item (each saved as its own entry); tick rows + Combine to merge a composite dish. */
export function EstimateCard({
  draft,
  confidence,
  previewUrl,
  saving,
  onChangeItem,
  onRemoveItem,
  onMerge,
  onChangeMeal,
  onChangeDate,
  onConfirm,
  onCancel,
}: Props) {
  const conf = confidence != null ? confidenceLabel(confidence) : null
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const items = draft.items
  const single = items.length === 1

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const remove = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    onRemoveItem(id)
  }
  const selectedIds = items.filter((i) => selected.has(i.id)).map((i) => i.id)
  const combine = () => {
    onMerge(selectedIds)
    setSelected(new Set())
  }

  return (
    <div className="card estimate">
      {previewUrl && <img className="estimate__photo" src={previewUrl} alt="Food" />}

      {conf && <span className={`conf ${conf.cls}`}>{conf.text}</span>}

      {!single && (
        <p className="estimate__hint muted">
          {items.length} items — each is logged separately. Tick rows and Combine to merge a single dish.
        </p>
      )}

      <div className="estimate__items">
        {items.map((item) => (
          <ItemEditor
            key={item.id}
            item={item}
            single={single}
            selected={selected.has(item.id)}
            onToggleSelect={() => toggle(item.id)}
            onChange={(patch) => onChangeItem(item.id, patch)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </div>

      {selectedIds.length >= 2 && (
        <button type="button" className="btn btn--ghost estimate__combine" onClick={combine} disabled={saving}>
          Combine {selectedIds.length} into one
        </button>
      )}

      <label className="field">
        <span className="field__label">Meal</span>
        <select value={draft.meal} onChange={(e) => onChangeMeal(e.target.value as Meal)}>
          {MEAL_ORDER.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Date</span>
        <input
          type="date"
          max={localDayKey()}
          value={dayKeyOf(draft.logged_at)}
          onChange={(e) => onChangeDate(withDayKey(draft.logged_at, e.target.value || localDayKey()))}
        />
      </label>

      <div className="estimate__actions">
        <button className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Discard
        </button>
        <button className="btn btn--primary" onClick={onConfirm} disabled={saving || items.length === 0}>
          {saving ? 'Saving…' : `Add ${single ? '' : `${items.length} `}to log`}
        </button>
      </div>
    </div>
  )
}
