import { describe, expect, it } from 'vitest'
import { adultBodyFatGuide, estimateAdultBodyFatPercent } from './bodyFat'

describe('body-fat guidance', () => {
  it('estimates adult body-fat percentage from BMI, age, and gender', () => {
    expect(estimateAdultBodyFatPercent({
      age: 34,
      gender: 'female',
      heightCm: 165,
      weightKg: 72,
    })).toBeCloseTo(34.2, 1)

    expect(estimateAdultBodyFatPercent({
      age: 34,
      gender: 'male',
      heightCm: 170,
      weightKg: 80,
    })).toBeCloseTo(24.8, 1)
  })

  it('returns conservative adult target guidance by gender', () => {
    expect(adultBodyFatGuide('male')).toMatchObject({ low: 14, suggested: 19, high: 24 })
    expect(adultBodyFatGuide('female')).toMatchObject({ low: 21, suggested: 25, high: 31 })
  })
})
