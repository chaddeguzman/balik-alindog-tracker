import { useState, type FormEvent } from 'react'
import { todayLocal } from '../lib/date'
import { centimetersFromFeet, fromKilograms, toKilograms, unitRange } from '../lib/units'
import { TdeeSettingsFields } from './TdeeSettingsFields'
import type { ActivityLevel, Gender, Unit } from '../types'

interface ProfileInput {
  name: string
  preferredUnit: Unit
  heightCm: number
  birthDate: string
  gender: Gender
  activityLevel: ActivityLevel
  weeklyLossTargetKg: number
  currentWeightKg: number
  baselineBodyFatPercent?: number
  goalWeightKg: number
  goalBodyFatPercent?: number
}

interface Props {
  onSubmit: (input: ProfileInput) => void
  onCancel?: () => void
}

export function ProfileForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('')
  const [weeklyLossTargetKg, setWeeklyLossTargetKg] = useState(0.5)
  const [heightCm, setHeightCm] = useState('')
  const [heightFeet, setHeightFeet] = useState('')
  const [heightInches, setHeightInches] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [baselineBodyFat, setBaselineBodyFat] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [goalBodyFat, setGoalBodyFat] = useState('')
  const range = unitRange(unit)

  function changeUnit(next: Unit) {
    if (currentWeight) setCurrentWeight(fromKilograms(toKilograms(Number(currentWeight), unit), next).toFixed(1))
    if (goalWeight) setGoalWeight(fromKilograms(toKilograms(Number(goalWeight), unit), next).toFixed(1))
    setUnit(next)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const resolvedHeight = unit === 'kg'
      ? Number(heightCm)
      : centimetersFromFeet(Number(heightFeet), Number(heightInches || 0))
    onSubmit({
      name,
      preferredUnit: unit,
      heightCm: resolvedHeight,
      birthDate,
      gender: gender as Gender,
      activityLevel: activityLevel as ActivityLevel,
      weeklyLossTargetKg,
      currentWeightKg: toKilograms(Number(currentWeight), unit),
      baselineBodyFatPercent: baselineBodyFat ? Number(baselineBodyFat) : undefined,
      goalWeightKg: toKilograms(Number(goalWeight), unit),
      goalBodyFatPercent: goalBodyFat ? Number(goalBodyFat) : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="form-stack profile-form">
      <div className="form-section-heading">
        <span>1</span>
        <div><h3>Person</h3><p>Identify this member of your household.</p></div>
      </div>
      <div className="form-grid">
        <label>
          Profile name
          <input autoFocus maxLength={40} required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex" />
        </label>
        <label>
          Gender
          <select required value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
            <option value="" disabled>Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </div>
      <label className="short-field">
        Birthday
        <input type="date" required max={todayLocal()} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        <small className="field-note">Private to this browser and used only to calculate age.</small>
      </label>

      <div className="form-section-heading">
        <span>2</span>
        <div><h3>Baseline measurements</h3><p>These become the starting point for progress.</p></div>
      </div>
      <fieldset className="unit-fieldset">
        <legend>Preferred units</legend>
        <label><input type="radio" name="unit" value="kg" checked={unit === 'kg'} onChange={() => changeUnit('kg')} /> Metric</label>
        <label><input type="radio" name="unit" value="lb" checked={unit === 'lb'} onChange={() => changeUnit('lb')} /> US customary</label>
      </fieldset>
      <div className="form-grid">
        {unit === 'kg' ? (
          <label>
            Current height (cm)
            <input type="number" required min="80" max="250" step="0.1" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="e.g. 170" />
          </label>
        ) : (
          <div className="height-fields">
            <label>Height (ft)<input type="number" required min="2" max="8" step="1" value={heightFeet} onChange={(event) => setHeightFeet(event.target.value)} /></label>
            <label>Inches<input type="number" required min="0" max="11.9" step="0.1" value={heightInches} onChange={(event) => setHeightInches(event.target.value)} /></label>
          </div>
        )}
        <label>
          Current weight ({unit})
          <input type="number" required min={range.min} max={range.max} step={range.step} value={currentWeight} onChange={(event) => setCurrentWeight(event.target.value)} />
        </label>
      </div>
      <label className="short-field">
        Current body fat (%) <span className="optional">Optional</span>
        <input type="number" min="2" max="70" step="0.1" value={baselineBodyFat} onChange={(event) => setBaselineBodyFat(event.target.value)} placeholder="Leave blank if unknown" />
      </label>

      <div className="form-section-heading">
        <span>3</span>
        <div><h3>Initial goal</h3><p>The BMI guide can help refine this after creation.</p></div>
      </div>
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
      <div className="form-section-heading">
        <span>4</span>
        <div><h3>Daily calorie estimate</h3><p>Choose the assumptions used for the adult TDEE estimate.</p></div>
      </div>
      <TdeeSettingsFields
        activityLevel={activityLevel}
        weeklyLossTargetKg={weeklyLossTargetKg}
        onActivityLevelChange={setActivityLevel}
        onWeeklyLossTargetChange={setWeeklyLossTargetKg}
      />
      <div className="form-actions sticky-actions">
        {onCancel && <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>}
        <button className="button primary" type="submit">Create profile & baseline</button>
      </div>
    </form>
  )
}
