export type AdultBmiCategory = 'Underweight' | 'Healthy weight' | 'Overweight' | 'Obesity'

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
