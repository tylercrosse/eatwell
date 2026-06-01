import { useState } from 'react'

// Weight is stored canonically in kg; users may prefer pounds for display + entry.
export type WeightUnit = 'kg' | 'lb'

const KG_PER_LB = 0.45359237
const STORAGE_KEY = 'weight-unit'

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value
}

function loadUnit(): WeightUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'lb' ? 'lb' : 'kg'
  } catch {
    return 'kg'
  }
}

/** Weight unit preference, persisted to localStorage. */
export function useWeightUnit(): [WeightUnit, (u: WeightUnit) => void] {
  const [unit, setUnitState] = useState<WeightUnit>(loadUnit)
  const setUnit = (u: WeightUnit) => {
    try {
      localStorage.setItem(STORAGE_KEY, u)
    } catch {
      // ignore (private mode / disabled storage); preference just won't persist
    }
    setUnitState(u)
  }
  return [unit, setUnit]
}
