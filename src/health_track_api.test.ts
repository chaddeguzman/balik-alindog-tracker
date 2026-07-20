import { describe, expect, it } from 'vitest'
import {
  HEALTH_MEMORY_STORAGE_KEY,
  MISSING_HEALTH_API_MESSAGE,
  addHealthMemory,
  buildActiveProfileHealthContext,
  buildHealthPrompt,
  getStoredHealthMemories,
  sendHealthChatMessage,
} from './lib/healthTrackApi'
import { addMeasurement, addProfile, createMeasurement, createProfile, initialState } from './lib/storage'

function testProfile() {
  const profile = createProfile({
    name: 'Mika',
    preferredUnit: 'kg',
    heightCm: 165,
    birthDate: '1992-05-10',
    gender: 'female',
    currentWeightKg: 72,
    goalWeightKg: 65,
    goalBodyFatPercent: 24,
  })
  const state = addMeasurement(
    addProfile(initialState, profile),
    profile.id,
    createMeasurement({ date: '2026-01-02', weightKg: 71.2, bodyFatPercent: 29 }),
  )
  return state.profiles[0]
}

describe('health chat API helpers', () => {
  it('rejects missing API keys without making live requests', async () => {
    await expect(sendHealthChatMessage('How am I doing?', testProfile(), { apiKey: '' })).rejects.toThrow(MISSING_HEALTH_API_MESSAGE)
  })

  it('builds active-profile context with full history only for that profile', () => {
    const context = buildActiveProfileHealthContext(testProfile())

    expect(context).toContain('Active profile: Mika')
    expect(context).toContain('Height: 165 cm')
    expect(context).toContain('Goal body fat: 24.0%')
    expect(context).toContain('2026-01-02: weight 71.2 kg, body fat 29.0%')
    expect(context).not.toContain('Household')
  })

  it('includes wellness safety boundaries in the prompt', () => {
    const prompt = buildHealthPrompt('Should I cut weight fast?', testProfile(), [])

    expect(prompt).toContain('You are not a medical provider')
    expect(prompt).toContain('Do not diagnose')
    expect(prompt).toContain('unsafe weight-loss plans')
    expect(prompt).toContain('Keep answers to 2-3 sentences by default')
    expect(prompt).toContain('<active_profile_context>')
  })

  it('stores health memories under a health-specific key', () => {
    addHealthMemory('I prefer morning workouts.')

    expect(window.localStorage.getItem(HEALTH_MEMORY_STORAGE_KEY)).toContain('morning workouts')
    expect(getStoredHealthMemories()).toEqual([
      expect.objectContaining({ text: 'I prefer morning workouts.' }),
    ])
  })
})
