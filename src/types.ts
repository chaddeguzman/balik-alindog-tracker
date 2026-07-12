export type Unit = 'kg' | 'lb'
export type Theme = 'light' | 'dark' | 'system'
export type Gender = 'female' | 'male'

export interface Measurement {
  id: string
  date: string
  recordedAt: string
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

export interface AppState {
  schemaVersion: 4
  theme: Theme
  activeProfileId: string | null
  profiles: Profile[]
}
