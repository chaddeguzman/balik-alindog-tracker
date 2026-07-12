import { useId, useMemo, useState } from 'react'
import { formatDate } from '../lib/date'
import { fromKilograms } from '../lib/units'
import type { Measurement, Profile, Unit } from '../types'

type Metric = 'weight' | 'bodyFat'
type Range = 7 | 30 | 90 | 180
type ChartMode = 'actual' | 'sample'

interface Props {
  profile: Profile
}

const WIDTH = 720
const HEIGHT = 300
const PAD = { top: 24, right: 28, bottom: 48, left: 62 }
const MIN_HEALTHY_LOSS_KG_PER_WEEK = 0.45
const MAX_HEALTHY_LOSS_KG_PER_WEEK = 0.9
const MID_HEALTHY_LOSS_KG_PER_WEEK = (MIN_HEALTHY_LOSS_KG_PER_WEEK + MAX_HEALTHY_LOSS_KG_PER_WEEK) / 2
const MIN_FORECAST_WEEKS = 8
const MAX_FORECAST_WEEKS = 26
function selectEntries(entries: Measurement[], range: Range): Measurement[] {
  if (entries.length === 0) return entries
  const last = new Date(`${entries[entries.length - 1].date}T00:00:00`)
  const cutoff = new Date(last)
  cutoff.setDate(cutoff.getDate() - range + 1)
  return entries.filter((entry) => new Date(`${entry.date}T00:00:00`) >= cutoff)
}

function dateTime(date: string): number {
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

function rangeLabel(range: Range): string {
  if (range === 90) return '3m'
  if (range === 180) return '6m'
  return `${range}d`
}

function formatAxisDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function buildDateTicks(endDate: string, range: Range): string[] {
  const startDate = addDays(endDate, -range + 1)
  if (range === 7) return Array.from({ length: 7 }, (_, index) => addDays(startDate, index))
  if (range === 30) return [0, 7, 14, 21, 29].map((offset) => addDays(startDate, offset))
  if (range === 90) return [0, 30, 60, 89].map((offset) => addDays(startDate, offset))
  return [0, 30, 60, 90, 120, 150, 179].map((offset) => addDays(startDate, offset))
}

function buildForecastEntries(profile: Profile): { entries: Measurement[]; weeklyLossKg: number; reachesGoal: boolean } | null {
  const latest = profile.entries.at(-1)
  if (!latest) return null
  const remainingKg = latest.weightKg - profile.goalWeightKg
  if (remainingKg <= 0) return null

  const idealWeeks = Math.ceil(remainingKg / MID_HEALTHY_LOSS_KG_PER_WEEK)
  const forecastWeeks = Math.min(MAX_FORECAST_WEEKS, Math.max(MIN_FORECAST_WEEKS, idealWeeks))
  const requiredWeeklyLossKg = remainingKg / forecastWeeks
  const weeklyLossKg = requiredWeeklyLossKg <= MAX_HEALTHY_LOSS_KG_PER_WEEK
    ? requiredWeeklyLossKg
    : MAX_HEALTHY_LOSS_KG_PER_WEEK
  const reachesGoal = requiredWeeklyLossKg <= MAX_HEALTHY_LOSS_KG_PER_WEEK
  const entries = Array.from({ length: forecastWeeks + 1 }, (_, index) => {
    const weightKg = index === 0
      ? latest.weightKg
      : reachesGoal && index === forecastWeeks
        ? profile.goalWeightKg
        : Math.max(profile.goalWeightKg, latest.weightKg - weeklyLossKg * index)
    return {
      id: `forecast-${index}`,
      date: addDays(latest.date, index * 7),
      recordedAt: latest.recordedAt,
      weightKg,
    }
  })

  return { entries, weeklyLossKg, reachesGoal }
}

export function ProgressChart({ profile }: Props) {
  const [metric, setMetric] = useState<Metric>('weight')
  const [mode, setMode] = useState<ChartMode>('actual')
  const [range, setRange] = useState<Range>(30)
  const titleId = useId()
  const forecast = useMemo(() => buildForecastEntries(profile), [profile])
  const chartMode = metric === 'weight' ? mode : 'actual'
  const rangedEntries = useMemo(() => selectEntries(profile.entries, range), [profile.entries, range])
  const entries = chartMode === 'sample'
    ? forecast?.entries ?? []
    : metric === 'bodyFat'
      ? rangedEntries.filter((entry) => entry.bodyFatPercent !== undefined)
      : rangedEntries
  const unit: Unit = profile.preferredUnit
  const values = entries.map((entry) =>
    metric === 'weight' ? fromKilograms(entry.weightKg, unit) : entry.bodyFatPercent!,
  )
  const goal = metric === 'weight'
    ? fromKilograms(profile.goalWeightKg, unit)
    : profile.goalBodyFatPercent
  const allValues = goal == null ? values : [...values, goal]
  const rawMin = allValues.length ? Math.min(...allValues) : 0
  const rawMax = allValues.length ? Math.max(...allValues) : 1
  const spread = Math.max(rawMax - rawMin, metric === 'weight' ? 2 : 1)
  const min = Math.max(0, rawMin - spread * 0.18)
  const max = rawMax + spread * 0.18
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const endDate = chartMode === 'sample'
    ? entries.at(-1)?.date
    : profile.entries.at(-1)?.date
  const startDate = chartMode === 'sample'
    ? entries[0]?.date
    : endDate ? addDays(endDate, -range + 1) : entries[0]?.date
  const startTime = startDate ? dateTime(startDate) : 0
  const endTime = endDate ? dateTime(endDate) : startTime
  const x = (date: string, fallbackIndex: number) => {
    if (endTime <= startTime) return PAD.left + (entries.length <= 1 ? plotW / 2 : (fallbackIndex / (entries.length - 1)) * plotW)
    return PAD.left + ((dateTime(date) - startTime) / (endTime - startTime)) * plotW
  }
  const y = (value: number) => PAD.top + ((max - value) / (max - min || 1)) * plotH
  const points = values.map((value, index) => `${x(entries[index].date, index)},${y(value)}`).join(' ')
  const suffix = metric === 'weight' ? unit : '%'
  const forecastWeeklyLoss = forecast ? fromKilograms(forecast.weeklyLossKg, unit).toFixed(1) : null
  const xTicks = chartMode === 'actual' && endDate ? buildDateTicks(endDate, range) : entries.filter((_, index) => index % 4 === 0 || index === entries.length - 1).map((entry) => entry.date)

  return (
    <section className="card chart-card" aria-labelledby={titleId}>
      <div className="section-heading chart-heading">
        <div>
          <p className="eyebrow">Progress</p>
          <h2 id={titleId}>{metric === 'weight' ? 'Weight trend' : 'Body-fat trend'}</h2>
        </div>
        <div className="segmented" aria-label="Graph metric">
          <button className={metric === 'weight' ? 'active' : ''} onClick={() => setMetric('weight')}>Weight</button>
          <button className={metric === 'bodyFat' ? 'active' : ''} onClick={() => setMetric('bodyFat')}>Body fat</button>
        </div>
      </div>

      {metric === 'weight' && (
        <div className="chart-mode-row">
          <div className="segmented" aria-label="Progress graph mode">
            <button className={chartMode === 'actual' ? 'active' : ''} onClick={() => setMode('actual')}>Actual</button>
            <button className={chartMode === 'sample' ? 'active' : ''} disabled={!forecast} onClick={() => setMode('sample')}>Sample</button>
          </div>
          <p>
            {chartMode === 'sample' && forecast && forecastWeeklyLoss
              ? forecast.reachesGoal
                ? `Sample forecast: ${forecastWeeklyLoss} ${unit}/week toward goal over ${forecast.entries.length - 1} weeks.`
                : `Sample forecast: ${forecastWeeklyLoss} ${unit}/week for 6 months; goal likely needs more time.`
              : `Sample uses a safer ${MIN_HEALTHY_LOSS_KG_PER_WEEK} to ${MAX_HEALTHY_LOSS_KG_PER_WEEK} kg/week pace, roughly 1.6 to 3.6 kg/month.`}
          </p>
        </div>
      )}

      {chartMode === 'actual' && (
        <div className="range-row" aria-label="Graph date range">
          {([7, 30, 90, 180] as Range[]).map((item) => (
            <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>
              {rangeLabel(item)}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-chart">
          <span aria-hidden="true">↗</span>
          <p>{metric === 'bodyFat' ? 'Add a body-fat measurement to see this trend.' : 'Your progress graph will appear after the first measurement.'}</p>
        </div>
      ) : (
        <div className="chart-scroll">
          <svg className="progress-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${chartMode === 'sample' ? 'Sample forecast' : metric === 'weight' ? 'Weight' : 'Body-fat'} progress graph with ${entries.length} measurements`}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const gridY = PAD.top + ratio * plotH
              const label = max - ratio * (max - min)
              return (
                <g key={ratio}>
                  <line x1={PAD.left} x2={WIDTH - PAD.right} y1={gridY} y2={gridY} className="grid-line" />
                  <text x={PAD.left - 10} y={gridY + 4} textAnchor="end" className="axis-label">{label.toFixed(1)}</text>
                </g>
              )
            })}
            {xTicks.map((tick) => (
              <g key={tick}>
                <line x1={x(tick, 0)} x2={x(tick, 0)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="grid-line x-grid-line" />
                <text x={x(tick, 0)} y={HEIGHT - 15} textAnchor="middle" className="axis-label">{formatAxisDate(tick)}</text>
              </g>
            ))}
            {goal != null && goal >= min && goal <= max && (
              <g>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(goal)} y2={y(goal)} className="goal-line" />
                <text x={WIDTH - PAD.right} y={y(goal) - 7} textAnchor="end" className="goal-label">Goal {goal.toFixed(1)} {suffix}</text>
              </g>
            )}
            {entries.length > 1 && <polyline points={points} className={chartMode === 'sample' ? 'trend-line forecast-line' : 'trend-line'} />}
            {entries.map((entry, index) => (
              <circle key={entry.id} cx={x(entry.date, index)} cy={y(values[index])} r="5" className={chartMode === 'sample' ? 'data-point forecast-point' : 'data-point'} tabIndex={0} aria-label={`${chartMode === 'sample' ? 'Sample ' : ''}${formatDate(entry.date)}: ${values[index].toFixed(1)} ${suffix}`}>
                <title>{formatDate(entry.date)}: {values[index].toFixed(1)} {suffix}</title>
              </circle>
            ))}
          </svg>
        </div>
      )}
    </section>
  )
}
