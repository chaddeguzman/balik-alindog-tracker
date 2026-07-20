import { calculateAge } from './date'
import { calculateBmi } from './bmi'
import type { ActivityLevel, Gender, Profile } from '../types'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  'very-active': 1.725,
  'extra-active': 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  'very-active': 'Very Active',
  'extra-active': 'Extra Active',
}

export type TdeeStatus =
  | 'ready'
  | 'missing-data'
  | 'missing-settings'
  | 'underage'
  | 'underweight'
  | 'goal-reached'
  | 'not-viable'

export interface TdeeEstimate {
  status: TdeeStatus
  age?: number
  bmi?: number
  restingCalories?: number
  maintenanceCalories?: number
  dailyDeficit?: number
  dailyTargetCalories?: number
  roundedDailyTargetCalories?: number
  belowMinimum: boolean
}

export function calculateRestingCalories(input: {
  weightKg: number
  heightCm: number
  age: number
  gender: Gender
}): number {
  const genderAdjustment = input.gender === 'male' ? 5 : -161
  return (10 * input.weightKg) + (6.25 * input.heightCm) - (5 * input.age) + genderAdjustment
}

export function calculateMaintenanceCalories(restingCalories: number, activityLevel: ActivityLevel): number {
  return restingCalories * ACTIVITY_FACTORS[activityLevel]
}

export function calculateDailyDeficit(weeklyLossTargetKg: number): number {
  return (weeklyLossTargetKg * 7_700) / 7
}

export function roundCalories(value: number): number {
  return Math.round(value / 10) * 10
}

export function calculateProfileTdee(profile: Profile): TdeeEstimate {
  const latest = profile.entries.at(-1)
  if (!latest || !profile.heightCm || !profile.birthDate || !profile.gender) {
    return { status: 'missing-data', belowMinimum: false }
  }

  const age = calculateAge(profile.birthDate)
  if (age < 20) return { status: 'underage', age, belowMinimum: false }
  const bmi = calculateBmi(latest.weightKg, profile.heightCm)
  if (bmi < 18.5) return { status: 'underweight', age, bmi, belowMinimum: false }
  if (latest.weightKg <= profile.goalWeightKg) return { status: 'goal-reached', age, bmi, belowMinimum: false }
  if (!profile.activityLevel || profile.weeklyLossTargetKg === undefined) {
    return { status: 'missing-settings', age, bmi, belowMinimum: false }
  }

  const restingCalories = calculateRestingCalories({
    weightKg: latest.weightKg,
    heightCm: profile.heightCm,
    age,
    gender: profile.gender,
  })
  const maintenanceCalories = calculateMaintenanceCalories(restingCalories, profile.activityLevel)
  const shared = { age, bmi, restingCalories, maintenanceCalories, belowMinimum: false }

  const dailyDeficit = calculateDailyDeficit(profile.weeklyLossTargetKg)
  const dailyTargetCalories = maintenanceCalories - dailyDeficit
  if (dailyTargetCalories <= 0) {
    return { ...shared, status: 'not-viable', dailyDeficit, dailyTargetCalories }
  }

  return {
    ...shared,
    status: 'ready',
    dailyDeficit,
    dailyTargetCalories,
    roundedDailyTargetCalories: roundCalories(dailyTargetCalories),
    belowMinimum: dailyTargetCalories < 1_200,
  }
}
