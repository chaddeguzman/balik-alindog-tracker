import { useMemo, useState, type ChangeEvent } from 'react'
import {
  ADULT_HEALTHY_BMI_MAX,
  ADULT_HEALTHY_BMI_MIN,
  adultBmiCategory,
  adultHealthyWeightRange,
  bmiScalePosition,
  calculateBmi,
  clampWeightToHealthyRange,
  healthyBmiScalePosition,
  weightKgForHealthyBmi,
} from '../lib/bmi'
import { calculateAge } from '../lib/date'
import { formatHeight, formatWeight } from '../lib/units'
import type { Gender, Measurement, Profile } from '../types'

interface Props {
  profile: Profile
  onCompleteBaseline: () => void
  onSelectTargetWeight: (weightKg: number) => void
}

function genderLabel(gender?: Gender): string {
  if (gender === 'female') return 'Female'
  if (gender === 'male') return 'Male'
  return 'Missing'
}

interface AdultBmiGuideProps {
  profile: Profile
  onSelectTargetWeight: (weightKg: number) => void
  heightCm: number
  bmi: number
  category: string
  age: number
  baseline: Measurement
  range: { minKg: number; maxKg: number }
  middleWeightKg: number
}

function AdultBmiGuide({
  profile,
  onSelectTargetWeight,
  heightCm,
  bmi,
  category,
  age,
  baseline,
  range,
  middleWeightKg,
}: AdultBmiGuideProps) {
  const savedTarget = profile.goalWeightKg
  const savedTargetBmi = calculateBmi(savedTarget, heightCm)
  const savedClampedWeight = clampWeightToHealthyRange(savedTarget, heightCm)
  const savedClampedBmi = calculateBmi(savedClampedWeight, heightCm)

  // Draft preview state: starts clamped to the healthy range so the marker is always visible.
  // A key prop on this component (tied to profile.goalWeightKg) resets this state
  // when the saved target changes externally, replacing the need for a syncing useEffect.
  const [draftBmi, setDraftBmi] = useState(savedClampedBmi)
  const [drafting, setDrafting] = useState(false)

  const draftWeightKg = useMemo(() => weightKgForHealthyBmi(draftBmi, heightCm), [draftBmi, heightCm])
  const draftBmiRounded = Number(draftBmi.toFixed(1))
  const isPreviewing = drafting && Math.abs(draftWeightKg - savedTarget) > 0.05
  const displayWeightKg = isPreviewing ? draftWeightKg : savedTarget
  const displayBmi = isPreviewing ? draftBmiRounded : savedTargetBmi

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>) {
    setDraftBmi(Number(event.target.value))
    setDrafting(true)
  }

  function saveDraft() {
    onSelectTargetWeight(draftWeightKg)
    setDrafting(false)
  }

  return (
    <section className="card bmi-card">
      <div className="section-heading bmi-heading">
        <div>
          <p className="eyebrow">BMI guide</p>
          <h2>A general guide for {formatHeight(heightCm, profile.preferredUnit)}</h2>
          <p className="baseline-meta">Age {age} · {genderLabel(profile.gender)} · Baseline {formatWeight(baseline.weightKg, profile.preferredUnit)}</p>
        </div>
        <div className="bmi-score"><strong>{bmi.toFixed(1)}</strong><span>{category}</span></div>
      </div>

      <div className="bmi-scale" aria-label={`Current BMI ${bmi.toFixed(1)}, categorized as ${category}`}>
        <div className="bmi-marker bmi-marker-current" style={{ left: `${bmiScalePosition(bmi)}%` }}><span>Current</span></div>
        <div className="bmi-segments" aria-hidden="true">
          <span className="under"><b>Underweight</b><small>{'<'}</small>18.5</span>
          <span className="healthy"><b>Healthy</b><small>18.5–24.9</small></span>
          <span className="over"><b>Overweight</b><small>25–29.9</small></span>
          <span className="obese"><b>Obesity</b><small>30+</small></span>
        </div>
        <div className="bmi-target-marker" style={{ left: `${healthyBmiScalePosition(draftBmi)}%` }} aria-hidden="true"><span>Target</span></div>
        <input
          className="bmi-target-slider"
          type="range"
          min={ADULT_HEALTHY_BMI_MIN}
          max={ADULT_HEALTHY_BMI_MAX}
          step={0.1}
          value={draftBmi}
          aria-label="Target BMI"
          aria-valuetext={`${draftBmi.toFixed(1)} BMI, ${formatWeight(draftWeightKg, profile.preferredUnit)}`}
          onChange={handleDraftChange}
        />
      </div>

      <div className="bmi-summary-grid">
        <div>
          <span>General healthy-weight range</span>
          <dl className="bmi-range-values">
            <div><dt>Low</dt><dd>{formatWeight(range.minKg, profile.preferredUnit)}</dd></div>
            <div><dt>Mid</dt><dd>{formatWeight(middleWeightKg, profile.preferredUnit)}</dd></div>
            <div><dt>High</dt><dd>{formatWeight(range.maxKg, profile.preferredUnit)}</dd></div>
          </dl>
        </div>
        <div className={`bmi-target-box ${isPreviewing ? 'is-drafting' : ''}`}>
          <span>{isPreviewing ? 'Preview target' : 'Your selected target'}</span>
          <strong>{formatWeight(displayWeightKg, profile.preferredUnit)}</strong>
          <small>BMI {displayBmi.toFixed(1)} · {adultBmiCategory(displayBmi)}</small>
          {isPreviewing && <button className="button primary compact bmi-save-target" type="button" onClick={saveDraft}>Save target</button>}
        </div>
      </div>
      <p className="bmi-disclaimer">
        Adult BMI is a screening measure, not a diagnosis or personalized medical target. Consider health history, body composition, and professional advice when choosing a goal.
        <span className="guide-source">
          Source: <a href="https://www.calculator.net/bmi-calculator.html" target="_blank" rel="noreferrer">https://www.calculator.net/bmi-calculator.html</a>
        </span>
      </p>
    </section>
  )
}

export function BmiGuide({ profile, onCompleteBaseline, onSelectTargetWeight }: Props) {
  const latest = profile.entries.at(-1)
  if (!profile.heightCm || !profile.birthDate || !profile.gender || !latest) {
    return (
      <section className="card bmi-card incomplete-card">
        <div>
          <p className="eyebrow">Baseline profile</p>
          <h2>Complete this person’s starting stats</h2>
          <p>Add height, birthday, and gender to unlock automatically updated age and BMI guidance while keeping existing measurements intact.</p>
        </div>
        <button className="button primary" onClick={onCompleteBaseline}>Complete baseline</button>
      </section>
    )
  }

  const heightCm = profile.heightCm
  const bmi = calculateBmi(latest.weightKg, heightCm)
  const age = calculateAge(profile.birthDate)
  const isAdult = age >= 20
  const baseline = profile.entries.find((entry) => entry.id === profile.baselineEntryId) ?? profile.entries[0]

  if (!isAdult) {
    return (
      <section className="card bmi-card">
        <div className="section-heading">
          <div><p className="eyebrow">BMI guide</p><h2>Growth-aware guidance</h2><p className="baseline-meta">Age {age} · {genderLabel(profile.gender)} · Baseline {formatWeight(baseline.weightKg, profile.preferredUnit)}</p></div>
          <div className="bmi-score"><strong>{bmi.toFixed(1)}</strong><span>current BMI</span></div>
        </div>
        <div className="notice warning child-bmi-notice">
          <strong>Adult BMI ranges do not apply at age {age}.</strong>
          <span>Children and teens need BMI-for-age percentiles based on age and sex. Discuss an appropriate weight goal with a qualified healthcare professional.</span>
        </div>
        <p className="bmi-disclaimer">
          BMI is a screening measure, not a diagnosis.
          <span className="guide-source">
            Source: <a href="https://www.calculator.net/bmi-calculator.html" target="_blank" rel="noreferrer">https://www.calculator.net/bmi-calculator.html</a>
          </span>
        </p>
      </section>
    )
  }

  const range = adultHealthyWeightRange(heightCm)
  const middleWeightKg = (range.minKg + range.maxKg) / 2
  const category = adultBmiCategory(bmi)

  return (
    <AdultBmiGuide
      key={profile.goalWeightKg}
      profile={profile}
      onSelectTargetWeight={onSelectTargetWeight}
      heightCm={heightCm}
      bmi={bmi}
      category={category}
      age={age}
      baseline={baseline}
      range={range}
      middleWeightKg={middleWeightKg}
    />
  )
}
