import { describe, expect, it } from 'vitest'
import { formatWeight, fromKilograms, toKilograms } from './units'

describe('weight conversions', () => {
  it('stores pounds as kilograms and converts them back', () => {
    const kg = toKilograms(220.462, 'lb')
    expect(kg).toBeCloseTo(100, 3)
    expect(fromKilograms(kg, 'lb')).toBeCloseTo(220.462, 3)
  })

  it('formats the selected display unit', () => {
    expect(formatWeight(80, 'kg')).toBe('80.0 kg')
    expect(formatWeight(80, 'lb')).toBe('176.4 lb')
  })
})
