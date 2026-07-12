import { adultBmiCategory, adultHealthyWeightRange, calculateBmi } from '../lib/bmi'
import { formatHeight, formatWeight } from '../lib/units'
import type { Profile } from '../types'

interface Props {
  profile: Profile
  onCompleteBaseline: () => void
}

function markerPosition(bmi: number): string {
  return `${Math.max(0, Math.min(100, ((bmi - 14) / 26) * 100))}%`
}

function genderLabel(gender: NonNullable<Profile['gender']>): string {
  return { female: 'Female', male: 'Male', nonbinary: 'Non-binary', 'prefer-not-to-say': 'Gender not specified' }[gender]
}

export function BmiGuide({ profile, onCompleteBaseline }: Props) {
  const latest = profile.entries.at(-1)
  if (!profile.heightCm || !profile.age || !profile.gender || !latest) {
    return (
      <section className="card bmi-card incomplete-card">
        <div>
          <p className="eyebrow">Baseline profile</p>
          <h2>Complete this person’s starting stats</h2>
          <p>Add height, age, and gender to unlock BMI guidance while keeping the existing measurements intact.</p>
        </div>
        <button className="button primary" onClick={onCompleteBaseline}>Complete baseline</button>
      </section>
    )
  }

  const bmi = calculateBmi(latest.weightKg, profile.heightCm)
  const isAdult = profile.age >= 20
  const baseline = profile.entries.find((entry) => entry.id === profile.baselineEntryId) ?? profile.entries[0]

  if (!isAdult) {
    return (
      <section className="card bmi-card">
        <div className="section-heading">
          <div><p className="eyebrow">BMI guide</p><h2>Growth-aware guidance</h2><p className="baseline-meta">Age {profile.age} · {genderLabel(profile.gender)} · Baseline {formatWeight(baseline.weightKg, profile.preferredUnit)}</p></div>
          <div className="bmi-score"><strong>{bmi.toFixed(1)}</strong><span>current BMI</span></div>
        </div>
        <div className="notice warning child-bmi-notice">
          <strong>Adult BMI ranges do not apply at age {profile.age}.</strong>
          <span>Children and teens need BMI-for-age percentiles based on age and sex. Discuss an appropriate weight goal with a qualified healthcare professional.</span>
        </div>
        <p className="bmi-disclaimer">BMI is a screening measure, not a diagnosis.</p>
      </section>
    )
  }

  const range = adultHealthyWeightRange(profile.heightCm)
  const category = adultBmiCategory(bmi)
  const targetBmi = calculateBmi(profile.goalWeightKg, profile.heightCm)

  return (
    <section className="card bmi-card">
      <div className="section-heading bmi-heading">
        <div>
          <p className="eyebrow">BMI guide</p>
          <h2>A general guide for {formatHeight(profile.heightCm, profile.preferredUnit)}</h2>
          <p className="baseline-meta">Age {profile.age} · {genderLabel(profile.gender)} · Baseline {formatWeight(baseline.weightKg, profile.preferredUnit)}</p>
        </div>
        <div className="bmi-score"><strong>{bmi.toFixed(1)}</strong><span>{category}</span></div>
      </div>

      <div className="bmi-scale" aria-label={`Current BMI ${bmi.toFixed(1)}, categorized as ${category}`}>
        <div className="bmi-marker" style={{ left: markerPosition(bmi) }}><span>Current</span></div>
        <div className="bmi-segments" aria-hidden="true">
          <span className="under"><b>Underweight</b><small>&lt;18.5</small></span>
          <span className="healthy"><b>Healthy</b><small>18.5–24.9</small></span>
          <span className="over"><b>Overweight</b><small>25–29.9</small></span>
          <span className="obese"><b>Obesity</b><small>30+</small></span>
        </div>
      </div>

      <div className="bmi-summary-grid">
        <div><span>General healthy-weight range</span><strong>{formatWeight(range.minKg, profile.preferredUnit)} – {formatWeight(range.maxKg, profile.preferredUnit)}</strong></div>
        <div><span>Your selected target</span><strong>{formatWeight(profile.goalWeightKg, profile.preferredUnit)}</strong><small>BMI {targetBmi.toFixed(1)} · {adultBmiCategory(targetBmi)}</small></div>
      </div>
      <p className="bmi-disclaimer">Adult BMI is a screening measure, not a diagnosis or personalized medical target. Consider health history, body composition, and professional advice when choosing a goal.</p>
    </section>
  )
}
