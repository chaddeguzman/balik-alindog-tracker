import { describe, expect, it } from 'vitest'
import { todayLocal } from './date'
import {
  addFoodLibraryEntry,
  addMeasurement,
  addProfile,
  createFoodLibraryEntry,
  createMeasurement,
  createProfile,
  deleteFoodLibraryEntry,
  findDuplicateFoodEntry,
  initialState,
  loadState,
  restoreStateFromBackup,
  saveState,
  updateFoodLibraryEntry,
  updateMeasurement,
  updateProfileDetails,
} from './storage'

function profileInput(name = 'Alex') {
  return {
    name,
    preferredUnit: 'kg' as const,
    heightCm: 170,
    birthDate: '1990-01-15',
    gender: 'male' as const,
    activityLevel: 'moderate' as const,
    weeklyLossTargetKg: 0.5,
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

  it('updates a saved measurement only once', () => {
    const profile = createProfile(profileInput())
    const state = addProfile(initialState, profile)
    const entry = state.profiles[0].entries[0]

    const updated = updateMeasurement(state, profile.id, entry.id, { weightKg: 78.5, bodyFatPercent: 23 })

    expect(updated.profiles[0].entries[0].weightKg).toBe(78.5)
    expect(updated.profiles[0].entries[0].bodyFatPercent).toBe(23)
    expect(updated.profiles[0].entries[0].editedAt).toEqual(expect.any(String))
    expect(() => updateMeasurement(updated, profile.id, entry.id, { weightKg: 78 })).toThrow(/already been edited once/i)
  })

  it('restores saved profiles and measurements after a reload', () => {
    const profile = createProfile({ ...profileInput('Mika'), currentWeightKg: 72.5, goalWeightKg: 65 })
    const state = addProfile(initialState, profile)

    saveState(state)

    expect(loadState()).toEqual(state)
  })

  it('updates profile details without changing measurement history', () => {
    const profile = createProfile(profileInput('Mika'))
    const state = addProfile(initialState, profile)
    const updated = updateProfileDetails(state, profile.id, {
      name: '  Mika D  ',
      heightCm: 166,
      birthDate: '1991-02-20',
      gender: 'female',
      activityLevel: 'light',
      weeklyLossTargetKg: 0.6,
    })

    expect(updated.profiles[0].name).toBe('Mika D')
    expect(updated.profiles[0].heightCm).toBe(166)
    expect(updated.profiles[0].birthDate).toBe('1991-02-20')
    expect(updated.profiles[0].activityLevel).toBe('light')
    expect(updated.profiles[0].weeklyLossTargetKg).toBe(0.6)
    expect(updated.profiles[0].entries).toEqual(profile.entries)
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
    expect(migrated.schemaVersion).toBe(7)
    expect(migrated.foodLibrary).toEqual([])
    expect(migrated.profiles[0].name).toBe('Existing person')
    expect(migrated.profiles[0].entries[0].weightKg).toBe(80)
    expect(migrated.profiles[0].baselineEntryId).toBe('legacy-entry')
  })

  it('clears legacy gender values when migrating version-three data', () => {
    window.localStorage.setItem('balik-alindog-tracker:v1', JSON.stringify({
      schemaVersion: 3,
      theme: 'system',
      activeProfileId: 'legacy-profile',
      profiles: [{
        ...createProfile(profileInput('Legacy person')),
        id: 'legacy-profile',
        gender: 'prefer-not-to-say',
      }],
    }))

    const migrated = loadState()
    expect(migrated.schemaVersion).toBe(7)
    expect(migrated.profiles[0].name).toBe('Legacy person')
    expect(migrated.profiles[0].gender).toBeUndefined()
  })

  it('creates, updates, and deletes shared food-library entries', () => {
    const entry = createFoodLibraryEntry({
      food: '  Chicken   Adobo ',
      category: 'food',
      calories: 240,
      proteinGrams: 28,
      carbsGrams: 6,
      weightGrams: 150,
      mealType: 'lunch',
      remarks: '  Household recipe  ',
    })
    const added = addFoodLibraryEntry(initialState, entry)

    expect(added.foodLibrary[0]).toMatchObject({
      food: 'Chicken Adobo',
      calories: 240,
      proteinGrams: 28,
      carbsGrams: 6,
      weightGrams: 150,
      remarks: 'Household recipe',
    })

    const updated = updateFoodLibraryEntry(added, entry.id, {
      food: 'Chicken Adobo',
      category: 'food',
      calories: 260,
      proteinGrams: 30,
      carbsGrams: 8,
      weightGrams: 150,
      mealType: 'dinner',
      remarks: 'With rice',
    })
    expect(updated.foodLibrary[0]).toMatchObject({ calories: 260, proteinGrams: 30, carbsGrams: 8, mealType: 'dinner', updatedAt: expect.any(String) })
    expect(deleteFoodLibraryEntry(updated, entry.id).foodLibrary).toEqual([])
  })

  it('detects duplicate food names and weights without blocking storage', () => {
    const entry = createFoodLibraryEntry({
      food: 'Greek Yogurt',
      category: 'food',
      calories: 120,
      weightGrams: 100,
      mealType: 'breakfast',
    })
    const state = addFoodLibraryEntry(initialState, entry)

    expect(findDuplicateFoodEntry(state.foodLibrary, { food: ' greek   yogurt ', category: 'food', weightGrams: 100 })).toBe(entry)
    expect(findDuplicateFoodEntry(state.foodLibrary, { food: 'Greek Yogurt', category: 'food', weightGrams: 150 })).toBeUndefined()
    expect(findDuplicateFoodEntry(state.foodLibrary, { food: 'Greek Yogurt', category: 'drinks', weightGrams: 100 })).toBeUndefined()
    expect(addFoodLibraryEntry(state, createFoodLibraryEntry({
      food: 'Greek Yogurt',
      category: 'food',
      calories: 130,
      weightGrams: 100,
      mealType: 'snack',
    })).foodLibrary).toHaveLength(2)
  })

  it('restores the shared food library from a household backup', () => {
    const profile = createProfile(profileInput('Mika'))
    const state = addFoodLibraryEntry(addProfile(initialState, profile), createFoodLibraryEntry({
      food: 'Protein Shake',
      category: 'supplement',
      calories: 180,
      weightGrams: 300,
      mealType: 'flexible',
      remarks: 'After workouts',
    }))

    const restored = restoreStateFromBackup(JSON.stringify({ data: state }))

    expect(restored.schemaVersion).toBe(7)
    expect(restored.profiles[0].name).toBe('Mika')
    expect(restored.foodLibrary[0]).toMatchObject({ food: 'Protein Shake', category: 'supplement' })
  })

  it('migrates version-six data without losing profiles or shared foods', () => {
    const profile = createProfile(profileInput('Version Six'))
    const versionSixProfile = { ...profile }
    delete versionSixProfile.activityLevel
    delete versionSixProfile.weeklyLossTargetKg
    const food = createFoodLibraryEntry({
      food: 'Brown Rice',
      category: 'food',
      calories: 216,
      weightGrams: 200,
      mealType: 'flexible',
    })

    const restored = restoreStateFromBackup(JSON.stringify({
      data: {
        schemaVersion: 6,
        theme: 'system',
        activeProfileId: profile.id,
        profiles: [versionSixProfile],
        foodLibrary: [food],
      },
    }))

    expect(restored.schemaVersion).toBe(7)
    expect(restored.profiles[0].name).toBe('Version Six')
    expect(restored.profiles[0].activityLevel).toBeUndefined()
    expect(restored.profiles[0].weeklyLossTargetKg).toBeUndefined()
    expect(restored.foodLibrary[0].food).toBe('Brown Rice')
  })

  it('rejects backups with only one TDEE setting', () => {
    const profile = createProfile(profileInput('Partial'))
    const partialProfile = { ...profile, weeklyLossTargetKg: undefined }

    expect(() => restoreStateFromBackup(JSON.stringify({
      data: { ...initialState, profiles: [partialProfile], activeProfileId: partialProfile.id },
    }))).toThrow(/configured together/i)
  })
})
