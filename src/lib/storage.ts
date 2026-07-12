import { calculateAge, todayLocal } from './date'
import type { AppState, Gender, Measurement, Profile, Theme, Unit } from '../types'

export const STORAGE_KEY = 'balik-alindog-tracker:v1'
export const MAX_PROFILES = 10

export const initialState: AppState = {
  schemaVersion: 4,
  theme: 'system',
  activeProfileId: null,
  profiles: [],
}

interface LegacyAppState {
  schemaVersion: 1
  theme: Theme
  activeProfileId: string | null
  profiles: Array<Omit<Profile, 'heightCm' | 'age' | 'gender' | 'baselineEntryId'>>
}

interface VersionTwoAppState extends Omit<AppState, 'schemaVersion'> {
  schemaVersion: 2
}

interface VersionThreeAppState extends Omit<AppState, 'schemaVersion'> {
  schemaVersion: 3
}

function isGender(value: unknown): value is Gender {
  return value === 'female' || value === 'male'
}

function assertGender(value: Gender): void {
  if (!isGender(value)) throw new Error('Gender must be Male or Female.')
}

function sanitizeProfileGender<T extends { gender?: unknown }>(profile: T): T & { gender?: Gender } {
  return {
    ...profile,
    gender: isGender(profile.gender) ? profile.gender : undefined,
  }
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

function assertHeight(heightCm: number): void {
  if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) {
    throw new Error('Height must be between 80 and 250 centimeters.')
  }
}

function assertAge(age: number): void {
  if (!Number.isInteger(age) || age < 2 || age > 120) {
    throw new Error('Age must be a whole number between 2 and 120.')
  }
}

function assertBirthDate(birthDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new Error('A valid birthday is required.')
  const [year, month, day] = birthDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('A valid birthday is required.')
  }
  const age = calculateAge(birthDate)
  if (birthDate > todayLocal() || age < 2 || age > 120) {
    throw new Error('Birthday must represent an age between 2 and 120.')
  }
}

function migrateLegacyState(state: LegacyAppState): AppState {
  return {
    schemaVersion: 4,
    theme: state.theme,
    activeProfileId: state.activeProfileId,
    profiles: state.profiles.map((profile) => ({
      ...profile,
      baselineEntryId: profile.entries[0]?.id,
    })),
  }
}

function migrateVersionTwoState(state: VersionTwoAppState): AppState {
  return {
    ...state,
    schemaVersion: 4,
    profiles: state.profiles.map(sanitizeProfileGender),
  }
}

function migrateVersionThreeState(state: VersionThreeAppState): AppState {
  return {
    ...state,
    schemaVersion: 4,
    profiles: state.profiles.map(sanitizeProfileGender),
  }
}

function validateState(state: AppState): AppState {
  if (!['light', 'dark', 'system'].includes(state.theme)) throw new Error('Backup has an invalid theme.')
  if (!Array.isArray(state.profiles) || state.profiles.length > MAX_PROFILES) throw new Error('Backup has an invalid profile list.')
  for (const profile of state.profiles) {
    if (!profile || typeof profile.id !== 'string' || typeof profile.name !== 'string' || !profile.name.trim()) throw new Error('Backup contains an invalid profile.')
    if (!['kg', 'lb'].includes(profile.preferredUnit)) throw new Error('Backup contains an invalid unit.')
    assertWeight(profile.goalWeightKg)
    assertBodyFat(profile.goalBodyFatPercent)
    if (profile.heightCm !== undefined) assertHeight(profile.heightCm)
    if (profile.birthDate !== undefined) assertBirthDate(profile.birthDate)
    else if (profile.age !== undefined) assertAge(profile.age)
    if (profile.gender !== undefined && !isGender(profile.gender)) throw new Error('Backup contains an invalid gender.')
    if (!Array.isArray(profile.entries)) throw new Error('Backup contains invalid measurements.')
    const dates = new Set<string>()
    for (const entry of profile.entries) {
      if (!entry || typeof entry.id !== 'string' || typeof entry.recordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) throw new Error('Backup contains an invalid measurement.')
      assertWeight(entry.weightKg)
      assertBodyFat(entry.bodyFatPercent)
      if (dates.has(entry.date)) throw new Error('Backup contains duplicate measurement dates.')
      dates.add(entry.date)
    }
  }
  if (state.activeProfileId !== null && !state.profiles.some((profile) => profile.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0]?.id ?? null
  }
  return state
}

function parseState(value: unknown): AppState {
  if (!value || typeof value !== 'object') throw new Error('Backup is not valid tracker data.')
  const candidate = value as AppState | VersionThreeAppState | VersionTwoAppState | LegacyAppState
  if (!Array.isArray(candidate.profiles)) throw new Error('Backup is not valid tracker data.')
  if (candidate.schemaVersion === 1) return validateState(migrateLegacyState(candidate))
  if (candidate.schemaVersion === 2) return validateState(migrateVersionTwoState(candidate))
  if (candidate.schemaVersion === 3) return validateState(migrateVersionThreeState(candidate))
  if (candidate.schemaVersion === 4) return validateState(candidate)
  throw new Error('This backup version is not supported.')
}

function id(): string {
  return crypto.randomUUID()
}

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    return parseState(JSON.parse(raw))
  } catch {
    return initialState
  }
}

export function restoreStateFromBackup(text: string): AppState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
  const payload = parsed && typeof parsed === 'object' && 'data' in parsed ? (parsed as { data: unknown }).data : parsed
  return parseState(payload)
}

export function saveState(state: AppState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createProfile(input: {
  name: string
  preferredUnit: Unit
  heightCm: number
  birthDate: string
  gender: Gender
  currentWeightKg: number
  baselineBodyFatPercent?: number
  goalWeightKg: number
  goalBodyFatPercent?: number
}): Profile {
  if (!input.name.trim()) throw new Error('A profile name is required.')
  assertHeight(input.heightCm)
  assertBirthDate(input.birthDate)
  assertGender(input.gender)
  assertWeight(input.currentWeightKg)
  assertBodyFat(input.baselineBodyFatPercent)
  assertWeight(input.goalWeightKg)
  assertBodyFat(input.goalBodyFatPercent)
  const baseline = createMeasurement({
    date: todayLocal(),
    weightKg: input.currentWeightKg,
    bodyFatPercent: input.baselineBodyFatPercent,
  })
  return {
    id: id(),
    name: input.name.trim(),
    preferredUnit: input.preferredUnit,
    heightCm: input.heightCm,
    birthDate: input.birthDate,
    gender: input.gender,
    baselineEntryId: baseline.id,
    goalWeightKg: input.goalWeightKg,
    goalBodyFatPercent: input.goalBodyFatPercent,
    createdAt: new Date().toISOString(),
    entries: [baseline],
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
  bodyFatPercent?: number
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

export function completeProfileBaseline(
  state: AppState,
  profileId: string,
  input: { heightCm: number; birthDate: string; gender: Gender; currentWeightKg?: number; bodyFatPercent?: number },
): AppState {
  assertHeight(input.heightCm)
  assertBirthDate(input.birthDate)
  assertGender(input.gender)
  assertBodyFat(input.bodyFatPercent)
  if (input.currentWeightKg !== undefined) assertWeight(input.currentWeightKg)

  return {
    ...state,
    profiles: state.profiles.map((profile) => {
      if (profile.id !== profileId) return profile
      let entries = profile.entries
      if (entries.length === 0) {
        if (input.currentWeightKg === undefined) throw new Error('A baseline weight is required.')
        entries = [createMeasurement({ date: todayLocal(), weightKg: input.currentWeightKg, bodyFatPercent: input.bodyFatPercent })]
      }
      return {
        ...profile,
        heightCm: input.heightCm,
        birthDate: input.birthDate,
        age: undefined,
        gender: input.gender,
        baselineEntryId: entries[0].id,
        entries,
      }
    }),
  }
}

export function updateProfileDetails(
  state: AppState,
  profileId: string,
  input: { name: string; heightCm: number; birthDate: string; gender: Gender },
): AppState {
  if (!input.name.trim()) throw new Error('A profile name is required.')
  assertHeight(input.heightCm)
  assertBirthDate(input.birthDate)
  assertGender(input.gender)

  return {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            name: input.name.trim(),
            heightCm: input.heightCm,
            birthDate: input.birthDate,
            age: undefined,
            gender: input.gender,
          }
        : profile,
    ),
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
