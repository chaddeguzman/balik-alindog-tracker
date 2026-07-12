import { useState, type FormEvent } from 'react'
import { toKilograms, unitRange } from '../lib/units'
import type { Unit } from '../types'

interface Props {
  onSubmit: (input: { name: string; preferredUnit: Unit; goalWeightKg: number; goalBodyFatPercent?: number }) => void
  onCancel?: () => void
}

export function ProfileForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [goalWeight, setGoalWeight] = useState('')
  const [goalBodyFat, setGoalBodyFat] = useState('')
  const range = unitRange(unit)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      preferredUnit: unit,
      goalWeightKg: toKilograms(Number(goalWeight), unit),
      goalBodyFatPercent: goalBodyFat ? Number(goalBodyFat) : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="form-stack">
      <label>
        Profile name
        <input autoFocus maxLength={40} required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex" />
      </label>
      <fieldset className="unit-fieldset">
        <legend>Preferred weight unit</legend>
        <label><input type="radio" name="unit" value="kg" checked={unit === 'kg'} onChange={() => setUnit('kg')} /> Kilograms</label>
        <label><input type="radio" name="unit" value="lb" checked={unit === 'lb'} onChange={() => setUnit('lb')} /> Pounds</label>
      </fieldset>
      <div className="form-grid">
        <label>
          Target weight ({unit})
          <input type="number" required min={range.min} max={range.max} step={range.step} value={goalWeight} onChange={(event) => setGoalWeight(event.target.value)} />
        </label>
        <label>
          Target body fat (%) <span className="optional">Optional</span>
          <input type="number" min="2" max="70" step="0.1" value={goalBodyFat} onChange={(event) => setGoalBodyFat(event.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        {onCancel && <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>}
        <button className="button primary" type="submit">Create profile</button>
      </div>
    </form>
  )
}
