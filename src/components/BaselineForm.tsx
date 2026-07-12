import { useState, type FormEvent } from 'react'
import { todayLocal } from '../lib/date'
import { centimetersFromFeet, toKilograms, unitRange } from '../lib/units'
import type { Gender, Profile } from '../types'

interface Props {
  profile: Profile
  onSubmit: (input: { heightCm: number; birthDate: string; gender: Gender; currentWeightKg?: number; bodyFatPercent?: number }) => void
  onCancel: () => void
}

export function BaselineForm({ profile, onSubmit, onCancel }: Props) {
  const unit = profile.preferredUnit
  const needsMeasurement = profile.entries.length === 0
  const totalInches = profile.heightCm ? profile.heightCm / 2.54 : 0
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const [gender, setGender] = useState<Gender>(profile.gender ?? 'prefer-not-to-say')
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toFixed(1) ?? '')
  const [heightFeet, setHeightFeet] = useState(profile.heightCm ? String(Math.floor(totalInches / 12)) : '')
  const [heightInches, setHeightInches] = useState(profile.heightCm ? (totalInches % 12).toFixed(1) : '')
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const range = unitRange(unit)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      heightCm: unit === 'kg' ? Number(heightCm) : centimetersFromFeet(Number(heightFeet), Number(heightInches || 0)),
      birthDate,
      gender,
      currentWeightKg: needsMeasurement ? toKilograms(Number(weight), unit) : undefined,
      bodyFatPercent: needsMeasurement && bodyFat ? Number(bodyFat) : undefined,
    })
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <p className="helper-text">Your existing profile and measurement history will be preserved.</p>
      <div className="form-grid">
        <label>Birthday<input autoFocus type="date" required max={todayLocal()} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /><small className="field-note">Kept in this browser to calculate age automatically.</small></label>
        <label>Gender<select required value={gender} onChange={(event) => setGender(event.target.value as Gender)}><option value="prefer-not-to-say">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option></select></label>
      </div>
      {unit === 'kg' ? (
        <label>Current height (cm)<input type="number" required min="80" max="250" step="0.1" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} /></label>
      ) : (
        <div className="height-fields"><label>Height (ft)<input type="number" required min="2" max="8" step="1" value={heightFeet} onChange={(event) => setHeightFeet(event.target.value)} /></label><label>Inches<input type="number" required min="0" max="11.9" step="0.1" value={heightInches} onChange={(event) => setHeightInches(event.target.value)} /></label></div>
      )}
      {needsMeasurement && <div className="form-grid"><label>Current weight ({unit})<input type="number" required min={range.min} max={range.max} step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></label><label>Body fat (%) <span className="optional">Optional</span><input type="number" min="2" max="70" step="0.1" value={bodyFat} onChange={(event) => setBodyFat(event.target.value)} /></label></div>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Save baseline</button></div>
    </form>
  )
}
