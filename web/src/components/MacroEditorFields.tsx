import { NUTRIENT_ORDER, NUTRITION_DISPLAY } from '../lib/nutritionDisplay'
import { MacroInput } from './MacroInput'

export interface MacroEditorValues {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  weight_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
}

interface Props {
  values: MacroEditorValues
  servings?: number
  onChange: (patch: Partial<MacroEditorValues>) => void
}

export function MacroEditorFields({ values, servings = 1, onChange }: Props) {
  const scaled = (field: keyof MacroEditorValues) => values[field] * servings
  const update = (field: keyof MacroEditorValues, value: number) => onChange({ [field]: value / servings })

  return (
    <>
      <div className="macros macros--single">
        <MacroInput label="Calories" unit="kcal" value={scaled('calories')} onChange={(v) => update('calories', v)} />
      </div>

      <div className="macros">
        {NUTRIENT_ORDER.map((key) => {
          const display = NUTRITION_DISPLAY[key]
          return (
            <MacroInput
              key={key}
              label={display.label}
              unit="g"
              colorVar={display.colorVar}
              value={scaled(display.field as keyof MacroEditorValues)}
              onChange={(v) => update(display.field as keyof MacroEditorValues, v)}
            />
          )
        })}
      </div>

      <div className="macros">
        <MacroInput label="Weight" unit="g" value={scaled('weight_g')} onChange={(v) => update('weight_g', v)} />
        <MacroInput label="Sugar" unit="g" value={scaled('sugar_g')} onChange={(v) => update('sugar_g', v)} />
        <MacroInput label="Sodium" unit="mg" value={scaled('sodium_mg')} onChange={(v) => update('sodium_mg', v)} />
      </div>
    </>
  )
}
