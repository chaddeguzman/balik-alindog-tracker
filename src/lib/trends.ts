import type { Measurement } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

function toTime(date: string): number {
  return new Date(`${date}T00:00:00`).getTime()
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(year, month - 1, day + days)
  const yyyy = String(next.getFullYear())
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  const dd = String(next.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function average(entries: Measurement[]): number | null {
  if (entries.length === 0) return null
  return entries.reduce((total, entry) => total + entry.weightKg, 0) / entries.length
}

export function sevenDayAverage(entries: Measurement[], endDate = entries.at(-1)?.date): number | null {
  if (!endDate) return null
  const end = toTime(endDate)
  const start = end - 6 * DAY_MS
  return average(entries.filter((entry) => {
    const time = toTime(entry.date)
    return time >= start && time <= end
  }))
}

export function weeklyAverageChange(entries: Measurement[]): number | null {
  const latest = entries.at(-1)
  if (!latest) return null
  const latestAverage = sevenDayAverage(entries, latest.date)
  const previousEnd = addDays(latest.date, -7)
  const previousAverage = sevenDayAverage(entries, previousEnd)
  if (latestAverage === null || previousAverage === null) return null
  return latestAverage - previousAverage
}

export function estimateGoalDate(entries: Measurement[], goalWeightKg: number): string | null {
  const latest = entries.at(-1)
  if (!latest) return null
  const change = weeklyAverageChange(entries)
  if (change === null || change === 0) return null
  const remaining = latest.weightKg - goalWeightKg
  if (remaining === 0) return latest.date
  const movingTowardGoal = (remaining > 0 && change < 0) || (remaining < 0 && change > 0)
  if (!movingTowardGoal) return null
  const weeks = Math.abs(remaining / change)
  if (!Number.isFinite(weeks) || weeks > 260) return null
  return addDays(latest.date, Math.round(weeks * 7))
}
