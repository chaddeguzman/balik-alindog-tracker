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
