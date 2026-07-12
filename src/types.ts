export type Unit = 'kg' | 'lb'
export type Theme = 'light' | 'dark' | 'system'

export interface Measurement {
  id: string
  date: string
  recordedAt: string
  weightKg: number
  bodyFatPercent: number
}

export interface Profile {
  id: string
  name: string
  preferredUnit: Unit
  goalWeightKg: number
  goalBodyFatPercent?: number
  createdAt: string
  entries: Measurement[]
}

export interface AppState {
  schemaVersion: 1
  theme: Theme
  activeProfileId: string | null
  profiles: Profile[]
}
