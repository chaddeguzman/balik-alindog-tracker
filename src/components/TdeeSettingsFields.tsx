import type { ActivityLevel } from '../types'

export function TdeeSettingsFields({
  activityLevel,
  weeklyLossTargetKg,
  onActivityLevelChange,
  onWeeklyLossTargetChange,
}: {
  activityLevel: ActivityLevel | ''
  weeklyLossTargetKg: number
  onActivityLevelChange: (value: ActivityLevel) => void
  onWeeklyLossTargetChange: (value: number) => void
}) {
  return (
    <div className="tdee-settings-fields">
      <label>
        Activity level
        <select required value={activityLevel} onChange={(event) => onActivityLevelChange(event.target.value as ActivityLevel)}>
          <option value="" disabled>Select activity level</option>
          <option value="sedentary">Sedentary - little or no exercise</option>
          <option value="light">Light - exercise 1 to 3 days/week</option>
          <option value="moderate">Moderate - exercise 3 to 5 days/week</option>
          <option value="very-active">Very Active - exercise 6 to 7 days/week</option>
          <option value="extra-active">Extra Active - hard training or physical work</option>
        </select>
      </label>
      <label>
        Weekly loss target: <output>{weeklyLossTargetKg.toFixed(1)} kg</output>
        <input
          className="tdee-rate-slider"
          type="range"
          min="0.5"
          max="0.9"
          step="0.1"
          value={weeklyLossTargetKg}
          onChange={(event) => onWeeklyLossTargetChange(Number(event.target.value))}
        />
        <span className="range-labels" aria-hidden="true"><span>0.5 kg</span><span>0.9 kg</span></span>
      </label>
    </div>
  )
}
