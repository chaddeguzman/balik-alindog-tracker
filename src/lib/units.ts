import type { Unit } from '../types'

export const KG_PER_LB = 0.45359237

export function toKilograms(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function fromKilograms(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value / KG_PER_LB
}

export function formatWeight(weightKg: number, unit: Unit): string {
  return `${fromKilograms(weightKg, unit).toFixed(1)} ${unit}`
}

export function unitRange(unit: Unit) {
  return unit === 'kg'
    ? { min: 20, max: 500, step: 0.1 }
    : { min: 44, max: 1102, step: 0.1 }
}

export function centimetersFromFeet(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54
}

export function formatHeight(heightCm: number, unit: Unit): string {
  if (unit === 'kg') return `${heightCm.toFixed(0)} cm`
  const totalInches = heightCm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  return `${feet} ft ${inches} in`
}
