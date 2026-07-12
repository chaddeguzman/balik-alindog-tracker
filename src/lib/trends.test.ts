import { describe, expect, it } from 'vitest'
import { estimateGoalDate, sevenDayAverage, weeklyAverageChange } from './trends'
import type { Measurement } from '../types'

function entry(date: string, weightKg: number): Measurement {
  return { id: date, date, recordedAt: `${date}T06:00:00.000Z`, weightKg }
}

describe('trend helpers', () => {
  const entries = [
    entry('2026-01-01', 82),
    entry('2026-01-02', 81.8),
    entry('2026-01-03', 81.6),
    entry('2026-01-04', 81.4),
    entry('2026-01-05', 81.2),
    entry('2026-01-06', 81),
    entry('2026-01-07', 80.8),
    entry('2026-01-08', 80.4),
    entry('2026-01-09', 80.2),
    entry('2026-01-10', 80),
    entry('2026-01-11', 79.8),
    entry('2026-01-12', 79.6),
    entry('2026-01-13', 79.4),
    entry('2026-01-14', 79.2),
  ]

  it('calculates the latest 7-day average', () => {
    expect(sevenDayAverage(entries)).toBeCloseTo(79.8)
  })

  it('compares the latest 7-day average to the previous 7-day average', () => {
    expect(weeklyAverageChange(entries)).toBeCloseTo(-1.6)
  })

  it('estimates a goal date only when the trend moves toward the target', () => {
    expect(estimateGoalDate(entries, 77.2)).toBe('2026-01-23')
    expect(estimateGoalDate(entries, 85)).toBeNull()
  })
})
