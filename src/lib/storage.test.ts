import { describe, expect, it } from 'vitest'
import { todayLocal } from './date'
import {
  addMeasurement,
  addProfile,
  createMeasurement,
  createProfile,
  initialState,
  loadState,
  saveState,
} from './storage'

function profileInput(name = 'Alex') {
  return {
    name,
    preferredUnit: 'kg' as const,
    heightCm: 170,
    age: 35,
    gender: 'prefer-not-to-say' as const,
    currentWeightKg: 80,
    baselineBodyFatPercent: 25,
    goalWeightKg: 70,
  }
}

describe('tracker data rules', () => {
  it('creates and activates a profile', () => {
    const profile = createProfile({ ...profileInput('  Alex  ') })
    const state = addProfile(initialState, profile)
    expect(state.profiles[0].name).toBe('Alex')
    expect(state.activeProfileId).toBe(profile.id)
    expect(state.profiles[0].entries).toHaveLength(1)
    expect(state.profiles[0].baselineEntryId).toBe(state.profiles[0].entries[0].id)
  })

  it('rejects a second measurement on the same day', () => {
    const profile = createProfile(profileInput())
    const state = addProfile(initialState, profile)
    expect(() => addMeasurement(state, profile.id, createMeasurement({ date: todayLocal(), weightKg: 79, bodyFatPercent: 24 }))).toThrow(/already has an entry/i)
  })

  it('sorts entries by measurement date', () => {
    const profile = createProfile(profileInput())
    let state = addProfile(initialState, profile)
    state = addMeasurement(state, profile.id, createMeasurement({ date: '2000-01-01', weightKg: 82, bodyFatPercent: 26 }))
    expect(state.profiles[0].entries.map((entry) => entry.date)).toEqual(['2000-01-01', todayLocal()])
  })

  it('restores saved profiles and measurements after a reload', () => {
    const profile = createProfile({ ...profileInput('Mika'), currentWeightKg: 72.5, goalWeightKg: 65 })
    const state = addProfile(initialState, profile)

    saveState(state)

    expect(loadState()).toEqual(state)
  })

  it('migrates an existing version-one profile without losing measurements', () => {
    window.localStorage.setItem('balik-alindog-tracker:v1', JSON.stringify({
      schemaVersion: 1,
      theme: 'system',
      activeProfileId: 'legacy-profile',
      profiles: [{
        id: 'legacy-profile',
        name: 'Existing person',
        preferredUnit: 'kg',
        goalWeightKg: 70,
        createdAt: '2025-01-01T00:00:00.000Z',
        entries: [{ id: 'legacy-entry', date: '2025-01-01', recordedAt: '2025-01-01T00:00:00.000Z', weightKg: 80, bodyFatPercent: 25 }],
      }],
    }))

    const migrated = loadState()
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.profiles[0].name).toBe('Existing person')
    expect(migrated.profiles[0].entries[0].weightKg).toBe(80)
    expect(migrated.profiles[0].baselineEntryId).toBe('legacy-entry')
  })
})
