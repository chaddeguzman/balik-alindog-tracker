export type AdultBmiCategory = 'Underweight' | 'Healthy weight' | 'Overweight' | 'Obesity'

export const ADULT_HEALTHY_BMI_MIN = 18.5
export const ADULT_HEALTHY_BMI_MAX = 24.9
export const BMI_SCALE_MIN = 14
export const BMI_SCALE_MAX = 40

export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

export function adultBmiCategory(bmi: number): AdultBmiCategory {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Healthy weight'
  if (bmi < 30) return 'Overweight'
  return 'Obesity'
}

export function adultHealthyWeightRange(heightCm: number): { minKg: number; maxKg: number } {
  const heightM = heightCm / 100
  const squared = heightM * heightM
  return { minKg: 18.5 * squared, maxKg: 24.9 * squared }
}

/** Weight in kilograms that produces the given BMI at the given height. */
export function weightKgForBmi(bmi: number, heightCm: number): number {
  const heightM = heightCm / 100
  return bmi * heightM * heightM
}

/** Converts a weight on the healthy BMI range (18.5–24.9) to kilograms for a given height. */
export function weightKgForHealthyBmi(bmi: number, heightCm: number): number {
  return weightKgForBmi(clamp(bmi, ADULT_HEALTHY_BMI_MIN, ADULT_HEALTHY_BMI_MAX), heightCm)
}

/**
 * Clamps a target weight to the general adult healthy-weight range
 * for the given height, so draggable targets always stay within the band.
 */
export function clampWeightToHealthyRange(weightKg: number, heightCm: number): number {
  const range = adultHealthyWeightRange(heightCm)
  return clamp(weightKg, range.minKg, range.maxKg)
}

/** Maps a BMI value onto the rendered BMI scale (BMI 14–40) as a 0–100 percentage. */
export function bmiScalePosition(bmi: number): number {
  return Math.max(0, Math.min(100, ((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100))
}

/** Maps a BMI value within the healthy band (18.5–24.9) onto the full rendered scale. */
export function healthyBmiScalePosition(bmi: number): number {
  return bmiScalePosition(clamp(bmi, ADULT_HEALTHY_BMI_MIN, ADULT_HEALTHY_BMI_MAX))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}