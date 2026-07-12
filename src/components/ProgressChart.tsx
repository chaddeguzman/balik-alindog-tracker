import { useId, useMemo, useState } from 'react'
import { formatDate } from '../lib/date'
import { fromKilograms } from '../lib/units'
import type { Measurement, Profile, Unit } from '../types'

type Metric = 'weight' | 'bodyFat'
type Range = 7 | 30 | 90 | 'all'

interface Props {
  profile: Profile
}

const WIDTH = 720
const HEIGHT = 300
const PAD = { top: 24, right: 28, bottom: 48, left: 62 }

function selectEntries(entries: Measurement[], range: Range): Measurement[] {
  if (range === 'all' || entries.length === 0) return entries
  const last = new Date(`${entries[entries.length - 1].date}T00:00:00`)
  const cutoff = new Date(last)
  cutoff.setDate(cutoff.getDate() - range + 1)
  return entries.filter((entry) => new Date(`${entry.date}T00:00:00`) >= cutoff)
}

export function ProgressChart({ profile }: Props) {
  const [metric, setMetric] = useState<Metric>('weight')
  const [range, setRange] = useState<Range>(30)
  const titleId = useId()
  const entries = useMemo(() => selectEntries(profile.entries, range), [profile.entries, range])
  const unit: Unit = profile.preferredUnit
  const values = entries.map((entry) =>
    metric === 'weight' ? fromKilograms(entry.weightKg, unit) : entry.bodyFatPercent,
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
  const x = (index: number) => PAD.left + (entries.length <= 1 ? plotW / 2 : (index / (entries.length - 1)) * plotW)
  const y = (value: number) => PAD.top + ((max - value) / (max - min || 1)) * plotH
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const suffix = metric === 'weight' ? unit : '%'

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

      <div className="range-row" aria-label="Graph date range">
        {([7, 30, 90, 'all'] as Range[]).map((item) => (
          <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>
            {item === 'all' ? 'All' : `${item}d`}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty-chart">
          <span aria-hidden="true">↗</span>
          <p>Your progress graph will appear after the first measurement.</p>
        </div>
      ) : (
        <div className="chart-scroll">
          <svg className="progress-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${metric === 'weight' ? 'Weight' : 'Body-fat'} progress graph with ${entries.length} measurements`}>
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
            {goal != null && goal >= min && goal <= max && (
              <g>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(goal)} y2={y(goal)} className="goal-line" />
                <text x={WIDTH - PAD.right} y={y(goal) - 7} textAnchor="end" className="goal-label">Goal {goal.toFixed(1)} {suffix}</text>
              </g>
            )}
            {entries.length > 1 && <polyline points={points} className="trend-line" />}
            {entries.map((entry, index) => (
              <circle key={entry.id} cx={x(index)} cy={y(values[index])} r="5" className="data-point" tabIndex={0} aria-label={`${formatDate(entry.date)}: ${values[index].toFixed(1)} ${suffix}`}>
                <title>{formatDate(entry.date)}: {values[index].toFixed(1)} {suffix}</title>
              </circle>
            ))}
            <text x={PAD.left} y={HEIGHT - 15} className="axis-label">{formatDate(entries[0].date)}</text>
            {entries.length > 1 && <text x={WIDTH - PAD.right} y={HEIGHT - 15} textAnchor="end" className="axis-label">{formatDate(entries[entries.length - 1].date)}</text>}
          </svg>
        </div>
      )}
    </section>
  )
}
