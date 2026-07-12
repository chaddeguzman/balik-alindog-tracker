import type { AppState, Measurement, Profile, Theme, Unit } from '../types'

export const STORAGE_KEY = 'balik-alindog-tracker:v1'
export const MAX_PROFILES = 10

export const initialState: AppState = {
  schemaVersion: 1,
  theme: 'system',
  activeProfileId: null,
  profiles: [],
}

function assertWeight(weightKg: number): void {
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) {
    throw new Error('Weight must be between 20 and 500 kilograms.')
  }
}

function assertBodyFat(value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 2 || value > 70)) {
    throw new Error('Body-fat percentage must be between 2% and 70%.')
  }
}

function id(): string {
  return crypto.randomUUID()
}

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const state = JSON.parse(raw) as AppState
    if (state.schemaVersion !== 1 || !Array.isArray(state.profiles)) return initialState
    return state
  } catch {
    return initialState
  }
}

export function saveState(state: AppState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createProfile(input: {
  name: string
  preferredUnit: Unit
  goalWeightKg: number
  goalBodyFatPercent?: number
}): Profile {
  if (!input.name.trim()) throw new Error('A profile name is required.')
  assertWeight(input.goalWeightKg)
  assertBodyFat(input.goalBodyFatPercent)
  return {
    id: id(),
    name: input.name.trim(),
    preferredUnit: input.preferredUnit,
    goalWeightKg: input.goalWeightKg,
    goalBodyFatPercent: input.goalBodyFatPercent,
    createdAt: new Date().toISOString(),
    entries: [],
  }
}

export function addProfile(state: AppState, profile: Profile): AppState {
  if (state.profiles.length >= MAX_PROFILES) throw new Error('The 10-profile limit has been reached.')
  if (!profile.name) throw new Error('A profile name is required.')
  return {
    ...state,
    activeProfileId: profile.id,
    profiles: [...state.profiles, profile],
  }
}

export function createMeasurement(input: {
  date: string
  weightKg: number
  bodyFatPercent: number
}): Measurement {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('A valid measurement date is required.')
  assertWeight(input.weightKg)
  assertBodyFat(input.bodyFatPercent)
  return {
    id: id(),
    date: input.date,
    recordedAt: new Date().toISOString(),
    weightKg: input.weightKg,
    bodyFatPercent: input.bodyFatPercent,
  }
}

export function addMeasurement(state: AppState, profileId: string, entry: Measurement): AppState {
  return {
    ...state,
    profiles: state.profiles.map((profile) => {
      if (profile.id !== profileId) return profile
      if (profile.entries.some((item) => item.date === entry.date)) {
        throw new Error('This profile already has an entry for that date.')
      }
      return { ...profile, entries: [...profile.entries, entry].sort((a, b) => a.date.localeCompare(b.date)) }
    }),
  }
}

export function updateProfileSettings(
  state: AppState,
  profileId: string,
  input: Pick<Profile, 'preferredUnit' | 'goalWeightKg' | 'goalBodyFatPercent'>,
): AppState {
  assertWeight(input.goalWeightKg)
  assertBodyFat(input.goalBodyFatPercent)
  return {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === profileId ? { ...profile, ...input } : profile,
    ),
  }
}

export function setTheme(state: AppState, theme: Theme): AppState {
  return { ...state, theme }
}
