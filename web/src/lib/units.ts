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

const CM_PER_IN = 2.54

/** Split a height in cm into feet + inches (inches rounded, carrying to feet at 12). */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_IN)
  const ft = Math.floor(totalIn / 12)
  return { ft, inch: totalIn - ft * 12 }
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * CM_PER_IN
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
