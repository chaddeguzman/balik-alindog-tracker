import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_FACTORS,
  calculateDailyDeficit,
  calculateMaintenanceCalories,
  calculateProfileTdee,
  calculateRestingCalories,
  roundCalories,
} from './tdee'
import type { Profile } from '../types'

function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile',
    name: 'Alex',
    preferredUnit: 'kg',
    heightCm: 175,
    birthDate: '1990-01-15',
    gender: 'male',
    activityLevel: 'moderate',
    weeklyLossTargetKg: 0.5,
    goalWeightKg: 70,
    createdAt: '2026-01-01T00:00:00.000Z',
    entries: [{
      id: 'measurement',
      date: '2026-01-01',
      recordedAt: '2026-01-01T00:00:00.000Z',
      weightKg: 80,
    }],
    ...overrides,
  }
}

describe('TDEE estimates', () => {
  it('calculates male and female Mifflin-St Jeor resting calories', () => {
    expect(calculateRestingCalories({ weightKg: 80, heightCm: 180, age: 40, gender: 'male' })).toBe(1730)
    expect(calculateRestingCalories({ weightKg: 80, heightCm: 180, age: 40, gender: 'female' })).toBe(1564)
  })

  it('uses every configured activity factor', () => {
    for (const [activityLevel, factor] of Object.entries(ACTIVITY_FACTORS)) {
      expect(calculateMaintenanceCalories(1_500, activityLevel as keyof typeof ACTIVITY_FACTORS)).toBe(1_500 * factor)
    }
  })

  it('converts every supported weekly rate into a daily deficit', () => {
    expect([0.5, 0.6, 0.7, 0.8, 0.9].map(calculateDailyDeficit)).toEqual([550, 660, 770, 880, 990])
    expect(roundCalories(1_864)).toBe(1_860)
    expect(roundCalories(1_866)).toBe(1_870)
  })

  it('returns a ready estimate from the latest measurement', () => {
    const estimate = calculateProfileTdee(profileFixture())

    expect(estimate.status).toBe('ready')
    expect(estimate.maintenanceCalories).toBeGreaterThan(2_000)
    expect(estimate.dailyTargetCalories).toBeGreaterThan(1_200)
    expect(estimate.roundedDailyTargetCalories! % 10).toBe(0)
    expect(estimate.belowMinimum).toBe(false)
  })

  it('requires settings and limits estimates to adults age 20+', () => {
    expect(calculateProfileTdee(profileFixture({ activityLevel: undefined, weeklyLossTargetKg: undefined })).status).toBe('missing-settings')
    expect(calculateProfileTdee(profileFixture({ birthDate: '2010-01-15' })).status).toBe('underage')
  })

  it('blocks underweight, reached-goal, and non-viable targets', () => {
    expect(calculateProfileTdee(profileFixture({
      heightCm: 180,
      goalWeightKg: 45,
      entries: [{ id: 'm', date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', weightKg: 50 }],
    })).status).toBe('underweight')
    expect(calculateProfileTdee(profileFixture({
      goalWeightKg: 80,
    })).status).toBe('goal-reached')
    expect(calculateProfileTdee(profileFixture({
      heightCm: 145,
      birthDate: '1926-01-15',
      gender: 'female',
      activityLevel: 'sedentary',
      weeklyLossTargetKg: 0.9,
      goalWeightKg: 35,
      entries: [{ id: 'm', date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', weightKg: 40 }],
    })).status).toBe('not-viable')
  })

  it('flags but does not clamp a positive target below 1,200 calories', () => {
    const estimate = calculateProfileTdee(profileFixture({
      heightCm: 165,
      birthDate: '1990-01-15',
      gender: 'female',
      activityLevel: 'sedentary',
      weeklyLossTargetKg: 0.9,
      goalWeightKg: 55,
      entries: [{ id: 'm', date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', weightKg: 60 }],
    }))

    expect(estimate.status).toBe('ready')
    expect(estimate.dailyTargetCalories).toBeGreaterThan(0)
    expect(estimate.dailyTargetCalories).toBeLessThan(1_200)
    expect(estimate.belowMinimum).toBe(true)
  })
})
