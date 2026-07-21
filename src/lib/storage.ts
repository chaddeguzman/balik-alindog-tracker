import { calculateAge, todayLocal } from './date'
import type {
  ActivityLevel,
  AppState,
  FoodCategory,
  FoodLibraryEntry,
  Gender,
  MealType,
  Measurement,
  Profile,
  Theme,
  Unit,
} from '../types'

export const STORAGE_KEY = 'balik-alindog-tracker:v1'
export const MAX_PROFILES = 10

export const initialState: AppState = {
  schemaVersion: 7,
  theme: 'system',
  activeProfileId: null,
  profiles: [],
  foodLibrary: [],
}

interface LegacyAppState {
  schemaVersion: 1
  theme: Theme
  activeProfileId: string | null
  profiles: Array<Omit<Profile, 'heightCm' | 'age' | 'gender' | 'baselineEntryId'>>
}

interface VersionTwoAppState extends Omit<AppState, 'schemaVersion' | 'foodLibrary'> {
  schemaVersion: 2
}

interface VersionThreeAppState extends Omit<AppState, 'schemaVersion' | 'foodLibrary'> {
  schemaVersion: 3
}

interface VersionFourAppState extends Omit<AppState, 'schemaVersion' | 'foodLibrary'> {
  schemaVersion: 4
}

interface VersionFiveAppState extends Omit<AppState, 'schemaVersion' | 'foodLibrary'> {
  schemaVersion: 5
}

interface VersionSixAppState extends Omit<AppState, 'schemaVersion'> {
  schemaVersion: 6
}

function isGender(value: unknown): value is Gender {
  return value === 'female' || value === 'male'
}

function assertGender(value: Gender): void {
  if (!isGender(value)) throw new Error('Gender must be Male or Female.')
}

function isActivityLevel(value: unknown): value is ActivityLevel {
  return value === 'sedentary'
    || value === 'light'
    || value === 'moderate'
    || value === 'very-active'
    || value === 'extra-active'
}

function assertTdeeSettings(activityLevel: ActivityLevel | undefined, weeklyLossTargetKg: number | undefined): void {
  if ((activityLevel === undefined) !== (weeklyLossTargetKg === undefined)) {
    throw new Error('Activity level and weekly loss target must be configured together.')
  }
  if (activityLevel === undefined || weeklyLossTargetKg === undefined) return
  if (!isActivityLevel(activityLevel)) throw new Error('Select a valid activity level.')
  const allowedTargets = [0.5, 0.6, 0.7, 0.8, 0.9]
  if (!Number.isFinite(weeklyLossTargetKg) || !allowedTargets.some((target) => Math.abs(target - weeklyLossTargetKg) < 0.001)) {
    throw new Error('Weekly loss target must be between 0.5 and 0.9 kilograms.')
  }
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

function isFoodCategory(value: unknown): value is FoodCategory {
  return value === 'food' || value === 'drinks' || value === 'supplement'
}

function isMealType(value: unknown): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack' || value === 'flexible'
}

function assertFoodLibraryInput(input: {
  food: string
  category: FoodCategory
  calories: number
  proteinGrams?: number
  carbsGrams?: number
  weightGrams: number
  mealType: MealType
  remarks: string
}): void {
  if (!input.food.trim() || input.food.trim().length > 100) {
    throw new Error('Food must be between 1 and 100 characters.')
  }
  if (!isFoodCategory(input.category)) throw new Error('Select a valid food category.')
  if (!Number.isFinite(input.calories) || input.calories < 0 || input.calories > 100_000) {
    throw new Error('Calories must be between 0 and 100,000.')
  }
  if (input.proteinGrams !== undefined && (!Number.isFinite(input.proteinGrams) || input.proteinGrams < 0 || input.proteinGrams > 100_000)) {
    throw new Error('Protein must be between 0 and 100,000 grams.')
  }
  if (input.carbsGrams !== undefined && (!Number.isFinite(input.carbsGrams) || input.carbsGrams < 0 || input.carbsGrams > 100_000)) {
    throw new Error('Carbs must be between 0 and 100,000 grams.')
  }
  if (!Number.isFinite(input.weightGrams) || input.weightGrams <= 0 || input.weightGrams > 100_000) {
    throw new Error('Weight must be greater than 0 and no more than 100,000 grams.')
  }
  if (!isMealType(input.mealType)) throw new Error('Select a valid meal type.')
  if (input.remarks.length > 500) throw new Error('Remarks cannot exceed 500 characters.')
}

function migrateLegacyState(state: LegacyAppState): AppState {
  return {
    schemaVersion: 7,
    theme: state.theme,
    activeProfileId: state.activeProfileId,
    profiles: state.profiles.map((profile) => ({
      ...profile,
      baselineEntryId: profile.entries[0]?.id,
    })),
    foodLibrary: [],
  }
}

function migrateVersionTwoState(state: VersionTwoAppState): AppState {
  return {
    ...state,
    schemaVersion: 7,
    profiles: state.profiles.map(sanitizeProfileGender),
    foodLibrary: [],
  }
}

function migrateVersionThreeState(state: VersionThreeAppState): AppState {
  return {
    ...state,
    schemaVersion: 7,
    profiles: state.profiles.map(sanitizeProfileGender),
    foodLibrary: [],
  }
}

function migrateVersionFourState(state: VersionFourAppState): AppState {
  return {
    ...state,
    schemaVersion: 7,
    foodLibrary: [],
  }
}

function migrateVersionFiveState(state: VersionFiveAppState): AppState {
  return {
    ...state,
    schemaVersion: 7,
    foodLibrary: [],
  }
}

function migrateVersionSixState(state: VersionSixAppState): AppState {
  return {
    ...state,
    schemaVersion: 7,
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
    assertTdeeSettings(profile.activityLevel, profile.weeklyLossTargetKg)
    if (!Array.isArray(profile.entries)) throw new Error('Backup contains invalid measurements.')
    const dates = new Set<string>()
    for (const entry of profile.entries) {
      if (!entry || typeof entry.id !== 'string' || typeof entry.recordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) throw new Error('Backup contains an invalid measurement.')
      if (entry.editedAt !== undefined && typeof entry.editedAt !== 'string') throw new Error('Backup contains an invalid measurement.')
      assertWeight(entry.weightKg)
      assertBodyFat(entry.bodyFatPercent)
      if (dates.has(entry.date)) throw new Error('Backup contains duplicate measurement dates.')
      dates.add(entry.date)
    }
  }
  if (!Array.isArray(state.foodLibrary)) throw new Error('Backup contains an invalid food library.')
  const foodIds = new Set<string>()
  for (const entry of state.foodLibrary) {
    if (
      !entry
      || typeof entry.id !== 'string'
      || typeof entry.food !== 'string'
      || typeof entry.remarks !== 'string'
      || typeof entry.createdAt !== 'string'
      || (entry.updatedAt !== undefined && typeof entry.updatedAt !== 'string')
      || (entry.proteinGrams !== undefined && typeof entry.proteinGrams !== 'number')
      || (entry.carbsGrams !== undefined && typeof entry.carbsGrams !== 'number')
    ) {
      throw new Error('Backup contains an invalid food entry.')
    }
    assertFoodLibraryInput(entry)
    if (foodIds.has(entry.id)) throw new Error('Backup contains duplicate food entry IDs.')
    foodIds.add(entry.id)
  }
  if (state.activeProfileId !== null && !state.profiles.some((profile) => profile.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0]?.id ?? null
  }
  return state
}

function parseState(value: unknown): AppState {
  if (!value || typeof value !== 'object') throw new Error('Backup is not valid tracker data.')
  const candidate = value as AppState | VersionSixAppState | VersionFiveAppState | VersionFourAppState | VersionThreeAppState | VersionTwoAppState | LegacyAppState
  if (!Array.isArray(candidate.profiles)) throw new Error('Backup is not valid tracker data.')
  if (candidate.schemaVersion === 1) return validateState(migrateLegacyState(candidate))
  if (candidate.schemaVersion === 2) return validateState(migrateVersionTwoState(candidate))
  if (candidate.schemaVersion === 3) return validateState(migrateVersionThreeState(candidate))
  if (candidate.schemaVersion === 4) return validateState(migrateVersionFourState(candidate))
  if (candidate.schemaVersion === 5) return validateState(migrateVersionFiveState(candidate))
  if (candidate.schemaVersion === 6) return validateState(migrateVersionSixState(candidate))
  if (candidate.schemaVersion === 7) return validateState(candidate)
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
  activityLevel: ActivityLevel
  weeklyLossTargetKg: number
  currentWeightKg: number
  baselineBodyFatPercent?: number
  goalWeightKg: number
  goalBodyFatPercent?: number
}): Profile {
  if (!input.name.trim()) throw new Error('A profile name is required.')
  assertHeight(input.heightCm)
  assertBirthDate(input.birthDate)
  assertGender(input.gender)
  assertTdeeSettings(input.activityLevel, input.weeklyLossTargetKg)
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
    activityLevel: input.activityLevel,
    weeklyLossTargetKg: input.weeklyLossTargetKg,
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
  input: {
    name: string
    heightCm: number
    birthDate: string
    gender: Gender
    activityLevel: ActivityLevel
    weeklyLossTargetKg: number
  },
): AppState {
  if (!input.name.trim()) throw new Error('A profile name is required.')
  assertHeight(input.heightCm)
  assertBirthDate(input.birthDate)
  assertGender(input.gender)
  assertTdeeSettings(input.activityLevel, input.weeklyLossTargetKg)

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
            activityLevel: input.activityLevel,
            weeklyLossTargetKg: input.weeklyLossTargetKg,
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

export function updateMeasurement(
  state: AppState,
  profileId: string,
  entryId: string,
  input: { weightKg: number; bodyFatPercent?: number },
): AppState {
  assertWeight(input.weightKg)
  assertBodyFat(input.bodyFatPercent)

  return {
    ...state,
    profiles: state.profiles.map((profile) => {
      if (profile.id !== profileId) return profile
      if (!profile.entries.some((entry) => entry.id === entryId)) throw new Error('Measurement was not found.')
      return {
        ...profile,
        entries: profile.entries.map((entry) => {
          if (entry.id !== entryId) return entry
          if (entry.editedAt) throw new Error('This entry has already been edited once.')
          return {
            ...entry,
            editedAt: new Date().toISOString(),
            weightKg: input.weightKg,
            bodyFatPercent: input.bodyFatPercent,
          }
        }),
      }
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

export function normalizeFoodName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function findDuplicateFoodEntry(
  entries: FoodLibraryEntry[],
  input: Pick<FoodLibraryEntry, 'food' | 'weightGrams'>,
  excludeId?: string,
): FoodLibraryEntry | undefined {
  const normalizedFood = normalizeFoodName(input.food)
  return entries.find((entry) =>
    entry.id !== excludeId
    && normalizeFoodName(entry.food) === normalizedFood
    && entry.weightGrams === input.weightGrams,
  )
}

export function createFoodLibraryEntry(input: {
  food: string
  category: FoodCategory
  calories: number
  proteinGrams?: number
  carbsGrams?: number
  weightGrams: number
  mealType: MealType
  remarks?: string
}): FoodLibraryEntry {
  const cleanInput = {
    ...input,
    food: input.food.trim().replace(/\s+/g, ' '),
    remarks: input.remarks?.trim() ?? '',
  }
  assertFoodLibraryInput(cleanInput)
  return {
    id: id(),
    createdAt: new Date().toISOString(),
    ...cleanInput,
  }
}

export function addFoodLibraryEntry(state: AppState, entry: FoodLibraryEntry): AppState {
  assertFoodLibraryInput(entry)
  return { ...state, foodLibrary: [...state.foodLibrary, entry] }
}

export function updateFoodLibraryEntry(
  state: AppState,
  entryId: string,
  input: {
    food: string
    category: FoodCategory
    calories: number
    proteinGrams?: number
    carbsGrams?: number
    weightGrams: number
    mealType: MealType
    remarks?: string
  },
): AppState {
  const cleanInput = {
    ...input,
    food: input.food.trim().replace(/\s+/g, ' '),
    remarks: input.remarks?.trim() ?? '',
  }
  assertFoodLibraryInput(cleanInput)
  if (!state.foodLibrary.some((entry) => entry.id === entryId)) throw new Error('Food entry was not found.')
  return {
    ...state,
    foodLibrary: state.foodLibrary.map((entry) =>
      entry.id === entryId
        ? { ...entry, ...cleanInput, updatedAt: new Date().toISOString() }
        : entry,
    ),
  }
}

export function deleteFoodLibraryEntry(state: AppState, entryId: string): AppState {
  if (!state.foodLibrary.some((entry) => entry.id === entryId)) throw new Error('Food entry was not found.')
  return { ...state, foodLibrary: state.foodLibrary.filter((entry) => entry.id !== entryId) }
}

export function setTheme(state: AppState, theme: Theme): AppState {
  return { ...state, theme }
}
