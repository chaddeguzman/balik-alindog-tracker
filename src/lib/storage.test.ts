import { describe, expect, it } from 'vitest'
import { addMeasurement, addProfile, createMeasurement, createProfile, initialState } from './storage'

describe('tracker data rules', () => {
  it('creates and activates a profile', () => {
    const profile = createProfile({ name: '  Alex  ', preferredUnit: 'kg', goalWeightKg: 70 })
    const state = addProfile(initialState, profile)
    expect(state.profiles[0].name).toBe('Alex')
    expect(state.activeProfileId).toBe(profile.id)
  })

  it('rejects a second measurement on the same day', () => {
    const profile = createProfile({ name: 'Alex', preferredUnit: 'kg', goalWeightKg: 70 })
    const state = addProfile(initialState, profile)
    const first = addMeasurement(state, profile.id, createMeasurement({ date: '2026-07-12', weightKg: 80, bodyFatPercent: 25 }))
    expect(() => addMeasurement(first, profile.id, createMeasurement({ date: '2026-07-12', weightKg: 79, bodyFatPercent: 24 }))).toThrow(/already has an entry/i)
  })

  it('sorts entries by measurement date', () => {
    const profile = createProfile({ name: 'Alex', preferredUnit: 'kg', goalWeightKg: 70 })
    let state = addProfile(initialState, profile)
    state = addMeasurement(state, profile.id, createMeasurement({ date: '2026-07-12', weightKg: 79, bodyFatPercent: 24 }))
    state = addMeasurement(state, profile.id, createMeasurement({ date: '2026-07-10', weightKg: 80, bodyFatPercent: 25 }))
    expect(state.profiles[0].entries.map((entry) => entry.date)).toEqual(['2026-07-10', '2026-07-12'])
  })
})
