export type Unit = 'kg' | 'lb'
export type Theme = 'light' | 'dark' | 'system'
export type Gender = 'female' | 'male'
export type FoodCategory = 'food' | 'drinks' | 'supplement'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'flexible'

export interface Measurement {
  id: string
  date: string
  recordedAt: string
  editedAt?: string
  weightKg: number
  bodyFatPercent?: number
}

export interface Profile {
  id: string
  name: string
  preferredUnit: Unit
  heightCm?: number
  birthDate?: string
  /** Preserved only until a migrated profile supplies an exact birthday. */
  age?: number
  gender?: Gender
  baselineEntryId?: string
  goalWeightKg: number
  goalBodyFatPercent?: number
  createdAt: string
  entries: Measurement[]
}

export interface FoodLibraryEntry {
  id: string
  food: string
  category: FoodCategory
  calories: number
  weightGrams: number
  mealType: MealType
  remarks: string
  createdAt: string
  updatedAt?: string
}

export interface AppState {
  schemaVersion: 6
  theme: Theme
  activeProfileId: string | null
  profiles: Profile[]
  foodLibrary: FoodLibraryEntry[]
}
