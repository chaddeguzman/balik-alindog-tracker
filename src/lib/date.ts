export function todayLocal(): string {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function calculateAge(birthDate: string, today = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number)
  let age = today.getFullYear() - year
  const monthDelta = today.getMonth() + 1 - month
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < day)) age -= 1
  return age
}
