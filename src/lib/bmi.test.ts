import { describe, expect, it } from 'vitest'
import {
  ADULT_HEALTHY_BMI_MAX,
  ADULT_HEALTHY_BMI_MIN,
  adultBmiCategory,
  adultHealthyWeightRange,
  bmiScalePosition,
  calculateBmi,
  clampWeightToHealthyRange,
  healthyBmiScalePosition,
  weightKgForBmi,
  weightKgForHealthyBmi,
} from './bmi'

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

describe('BMI to weight conversion', () => {
  it('converts a BMI to the weight that produces it at a given height', () => {
    expect(weightKgForBmi(22.5, 170)).toBeCloseTo(65.025, 3)
  })

  it('clamps a BMI to the healthy band when converting to weight', () => {
    expect(weightKgForHealthyBmi(17, 170)).toBeCloseTo(weightKgForBmi(ADULT_HEALTHY_BMI_MIN, 170), 3)
    expect(weightKgForHealthyBmi(30, 170)).toBeCloseTo(weightKgForBmi(ADULT_HEALTHY_BMI_MAX, 170), 3)
    expect(weightKgForHealthyBmi(22, 170)).toBeCloseTo(weightKgForBmi(22, 170), 3)
  })

  it('clamps a target weight to the healthy range', () => {
    const range = adultHealthyWeightRange(170)
    expect(clampWeightToHealthyRange(40, 170)).toBeCloseTo(range.minKg, 3)
    expect(clampWeightToHealthyRange(90, 170)).toBeCloseTo(range.maxKg, 3)
    expect(clampWeightToHealthyRange(60, 170)).toBeCloseTo(60, 3)
  })
})

describe('BMI scale positioning', () => {
  it('maps a BMI onto the full rendered scale (14–40)', () => {
    expect(bmiScalePosition(14)).toBe(0)
    expect(bmiScalePosition(40)).toBe(100)
    expect(bmiScalePosition(27)).toBeCloseTo(50, 2)
    expect(bmiScalePosition(10)).toBe(0)
    expect(bmiScalePosition(50)).toBe(100)
  })

  it('maps a healthy-band BMI onto the full rendered scale', () => {
    expect(healthyBmiScalePosition(ADULT_HEALTHY_BMI_MIN)).toBeCloseTo(bmiScalePosition(18.5), 2)
    expect(healthyBmiScalePosition(ADULT_HEALTHY_BMI_MAX)).toBeCloseTo(bmiScalePosition(24.9), 2)
    expect(healthyBmiScalePosition(15)).toBeCloseTo(bmiScalePosition(18.5), 2)
    expect(healthyBmiScalePosition(30)).toBeCloseTo(bmiScalePosition(24.9), 2)
  })
})