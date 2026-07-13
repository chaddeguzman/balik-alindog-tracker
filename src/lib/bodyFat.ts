import type { Gender } from '../types'

export interface BodyFatGuide {
  low: number
  high: number
  suggested: number
  label: string
}

export function estimateAdultBodyFatPercent(input: {
  age: number
  gender: Gender
  heightCm: number
  weightKg: number
}): number {
  const heightM = input.heightCm / 100
  const bmi = input.weightKg / (heightM * heightM)
  const sex = input.gender === 'male' ? 1 : 0
  return (1.2 * bmi) + (0.23 * input.age) - (10.8 * sex) - 5.4
}

export function adultBodyFatGuide(gender: Gender): BodyFatGuide {
  if (gender === 'male') {
    return { low: 14, high: 24, suggested: 19, label: 'Male adult guide' }
  }
  return { low: 21, high: 31, suggested: 25, label: 'Female adult guide' }
}
