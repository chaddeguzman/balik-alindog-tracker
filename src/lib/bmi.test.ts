import { describe, expect, it } from 'vitest'
import { adultBmiCategory, adultHealthyWeightRange, calculateBmi } from './bmi'

describe('adult BMI guidance', () => {
  it('calculates BMI from canonical metric values', () => {
    expect(calculateBmi(70, 175)).toBeCloseTo(22.86, 2)
  })

  it('uses adult screening categories', () => {
    expect(adultBmiCategory(18.4)).toBe('Underweight')
    expect(adultBmiCategory(18.5)).toBe('Healthy weight')
    expect(adultBmiCategory(25)).toBe('Overweight')
    expect(adultBmiCategory(30)).toBe('Obesity')
  })

  it('derives the general adult healthy-weight range from height', () => {
    const range = adultHealthyWeightRange(170)
    expect(range.minKg).toBeCloseTo(53.465, 3)
    expect(range.maxKg).toBeCloseTo(71.96, 2)
  })
})
