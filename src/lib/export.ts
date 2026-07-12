import type { AppState, Profile } from '../types'

function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'profile'
}

function download(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportProfileCsv(profile: Profile): void {
  const rows = [
    ['profile', 'date', 'recorded_at', 'weight_kg', 'weight_lb', 'body_fat_percent'],
    ...profile.entries.map((entry) => [
      profile.name,
      entry.date,
      entry.recordedAt,
      entry.weightKg.toFixed(2),
      (entry.weightKg / 0.45359237).toFixed(2),
      entry.bodyFatPercent?.toFixed(1) ?? '',
    ]),
  ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  download(csv, `${safeName(profile.name)}-measurements.csv`, 'text/csv;charset=utf-8')
}

export function exportAllJson(state: AppState): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'Balik Alindog Tracker',
    data: state,
  }
  download(JSON.stringify(payload, null, 2), 'balik-alindog-backup.json', 'application/json')
}
