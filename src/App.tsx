import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { ProgressChart } from './components/ProgressChart'
import { BaselineForm } from './components/BaselineForm'
import { BmiGuide } from './components/BmiGuide'
import { adultBodyFatGuide, estimateAdultBodyFatPercent } from './lib/bodyFat'
import { calculateAge, formatDate, todayLocal } from './lib/date'
import { exportAllJson, exportProfileCsv } from './lib/export'
import {
  MAX_PROFILES,
  addMeasurement,
  addProfile,
  createMeasurement,
  createProfile,
  completeProfileBaseline,
  loadState,
  restoreStateFromBackup,
  saveState,
  setTheme,
  updateProfileDetails,
  updateProfileSettings,
} from './lib/storage'
import { estimateGoalDate, sevenDayAverage, weeklyAverageChange } from './lib/trends'
import { centimetersFromFeet, formatHeight, formatWeight, fromKilograms, toKilograms, unitRange } from './lib/units'
import type { AppState, Gender, Profile, Theme, Unit } from './types'

const LAST_BACKUP_KEY = 'balik-alindog-tracker:last-backup-at'
const BACKUP_REMINDER_DAYS = 14

function isBackupDue(lastBackupAt: string | null): boolean {
  return !lastBackupAt || Date.now() - new Date(lastBackupAt).getTime() > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function EntryForm({ profile, onSave, onCancel }: { profile: Profile; onSave: (date: string, weightKg: number, bodyFat?: number) => void; onCancel: () => void }) {
  const unit = profile.preferredUnit
  const date = todayLocal()
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [confirming, setConfirming] = useState(false)
  const range = unitRange(unit)
  const weightKg = toKilograms(Number(weight), unit)

  function review(event: FormEvent) {
    event.preventDefault()
    setConfirming(true)
  }

  if (confirming) {
    return (
      <div className="confirmation">
        <div className="notice warning">
          <strong>Check this entry carefully.</strong>
          <span>After saving, it cannot be edited or deleted.</span>
        </div>
        <dl className="confirmation-list">
          <div><dt>Date</dt><dd>{formatDate(date)}</dd></div>
          <div><dt>Weight</dt><dd>{Number(weight).toFixed(1)} {unit}</dd></div>
          <div><dt>Body fat</dt><dd>{bodyFat ? `${Number(bodyFat).toFixed(1)}%` : 'Not recorded'}</dd></div>
        </dl>
        <div className="form-actions">
          <button className="button secondary" onClick={() => setConfirming(false)}>Go back</button>
          <button className="button primary" onClick={() => onSave(date, weightKg, bodyFat ? Number(bodyFat) : undefined)}>Save permanently</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={review} className="form-stack">
      <p className="helper-text">For consistent results, record in the morning before eating or drinking.</p>
      <label>
        Measurement date
        <input type="date" readOnly value={date} />
        <small className="field-note">Captured from this device's system date.</small>
      </label>
      <div className="form-grid">
        <label>
          Weight ({unit})
          <input autoFocus type="number" inputMode="decimal" required min={range.min} max={range.max} step={range.step} value={weight} onChange={(event) => setWeight(event.target.value)} />
        </label>
        <label>
          Body fat (%) <span className="optional">Optional</span>
          <input type="number" inputMode="decimal" min="2" max="70" step="0.1" value={bodyFat} onChange={(event) => setBodyFat(event.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
        <button className="button primary" type="submit">Review entry</button>
      </div>
    </form>
  )
}

function EditProfileForm({ profile, onSave, onCancel }: { profile: Profile; onSave: (input: { name: string; heightCm: number; birthDate: string; gender: Gender }) => void; onCancel: () => void }) {
  const totalInches = profile.heightCm ? profile.heightCm / 2.54 : 0
  const [name, setName] = useState(profile.name)
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const [gender, setGender] = useState<Gender | ''>(profile.gender ?? '')
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toFixed(1) ?? '')
  const [heightFeet, setHeightFeet] = useState(profile.heightCm ? String(Math.floor(totalInches / 12)) : '')
  const [heightInches, setHeightInches] = useState(profile.heightCm ? (totalInches % 12).toFixed(1) : '')

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave({
      name,
      heightCm: profile.preferredUnit === 'kg' ? Number(heightCm) : centimetersFromFeet(Number(heightFeet), Number(heightInches || 0)),
      birthDate,
      gender: gender as Gender,
    })
  }

  return (
    <form onSubmit={submit} className="form-stack">
      <p className="helper-text">This updates profile details only. Saved measurements remain unchanged.</p>
      <label>
        Profile name
        <input autoFocus required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="form-grid">
        <label>
          Birthday
          <input type="date" required max={todayLocal()} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
          <small className="field-note">Kept in this browser to calculate age automatically.</small>
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
      {profile.preferredUnit === 'kg' ? (
        <label>
          Current height (cm)
          <input type="number" required min="80" max="250" step="0.1" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} />
        </label>
      ) : (
        <div className="height-fields">
          <label>Height (ft)<input type="number" required min="2" max="8" step="1" value={heightFeet} onChange={(event) => setHeightFeet(event.target.value)} /></label>
          <label>Inches<input type="number" required min="0" max="11.9" step="0.1" value={heightInches} onChange={(event) => setHeightInches(event.target.value)} /></label>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
        <button className="button primary" type="submit">Save profile</button>
      </div>
    </form>
  )
}

function SettingsForm({ profile, onSave }: { profile: Profile; onSave: (input: { preferredUnit: Unit; goalWeightKg: number; goalBodyFatPercent?: number }) => void }) {
  const [unit, setUnit] = useState(profile.preferredUnit)
  const [goalWeight, setGoalWeight] = useState(fromKilograms(profile.goalWeightKg, profile.preferredUnit).toFixed(1))
  const [goalBodyFat, setGoalBodyFat] = useState(profile.goalBodyFatPercent?.toString() ?? '')
  const range = unitRange(unit)

  function changeUnit(next: Unit) {
    setGoalWeight(fromKilograms(toKilograms(Number(goalWeight), unit), next).toFixed(1))
    setUnit(next)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave({
      preferredUnit: unit,
      goalWeightKg: toKilograms(Number(goalWeight), unit),
      goalBodyFatPercent: goalBodyFat ? Number(goalBodyFat) : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="settings-form">
      <div className="form-grid three">
        <label>
          Display unit
          <select value={unit} onChange={(event) => changeUnit(event.target.value as Unit)}>
            <option value="kg">Kilograms (kg)</option>
            <option value="lb">Pounds (lb)</option>
          </select>
        </label>
        <label>
          Target weight ({unit})
          <input type="number" required min={range.min} max={range.max} step="0.1" value={goalWeight} onChange={(event) => setGoalWeight(event.target.value)} />
        </label>
        <label>
          Target body fat (%)
          <input type="number" min="2" max="70" step="0.1" value={goalBodyFat} onChange={(event) => setGoalBodyFat(event.target.value)} placeholder="Optional" />
        </label>
      </div>
      <button className="button compact secondary" type="submit">Save preferences</button>
    </form>
  )
}

function genderLabel(gender?: Gender): string {
  return gender === 'female' ? 'Female' : gender === 'male' ? 'Male' : 'Missing'
}

function weeklyChangeLabel(changeKg: number | null, unit: Unit): string {
  if (changeKg === null) return 'Needs more history'
  if (Math.abs(changeKg) < 0.05) return `flat this week`
  const direction = changeKg < 0 ? 'down' : 'up'
  return `${direction} ${Math.abs(fromKilograms(changeKg, unit)).toFixed(1)} ${unit} this week`
}

function ProfileSummaryCard({ profile }: { profile: Profile }) {
  const latest = profile.entries.at(-1)
  const baseline = profile.entries.find((entry) => entry.id === profile.baselineEntryId) ?? profile.entries[0]

  return (
    <section className="card profile-summary-card" aria-label="Profile summary">
      <div className="section-heading">
        <div><p className="eyebrow">Profile</p><h2>{profile.name}</h2></div>
      </div>
      <dl className="profile-summary-grid">
        <div><dt>Height</dt><dd>{profile.heightCm ? formatHeight(profile.heightCm, profile.preferredUnit) : 'Missing'}</dd></div>
        <div><dt>Age</dt><dd>{profile.birthDate ? calculateAge(profile.birthDate) : 'Missing'}</dd></div>
        <div><dt>Gender</dt><dd>{genderLabel(profile.gender)}</dd></div>
        <div><dt>Starting</dt><dd>{baseline ? formatWeight(baseline.weightKg, profile.preferredUnit) : 'Missing'}</dd></div>
        <div><dt>Current</dt><dd>{latest ? formatWeight(latest.weightKg, profile.preferredUnit) : 'Missing'}</dd></div>
        <div><dt>Target</dt><dd>{formatWeight(profile.goalWeightKg, profile.preferredUnit)}</dd></div>
      </dl>
    </section>
  )
}

function BodyFatGuideCard({ profile, onSelectTarget }: { profile: Profile; onSelectTarget: (bodyFatPercent: number) => void }) {
  const latest = profile.entries.at(-1)
  const latestMeasured = [...profile.entries].reverse().find((entry) => entry.bodyFatPercent !== undefined)

  if (!profile.heightCm || !profile.birthDate || !profile.gender || !latest) {
    return (
      <section className="card body-fat-guide-card">
        <div>
          <p className="eyebrow">Body-fat guide</p>
          <h2>Complete profile stats for body-fat guidance</h2>
          <p className="body-fat-copy">Height, birthday, gender, and weight are needed for a general estimate.</p>
        </div>
      </section>
    )
  }

  const age = calculateAge(profile.birthDate)
  if (age < 20) {
    return (
      <section className="card body-fat-guide-card">
        <div>
          <p className="eyebrow">Body-fat guide</p>
          <h2>Adult guidance starts at age 20</h2>
          <p className="body-fat-copy">For teens and children, body composition goals should use age- and sex-specific professional guidance.</p>
        </div>
      </section>
    )
  }

  const guide = adultBodyFatGuide(profile.gender)
  const currentBodyFat = latestMeasured?.bodyFatPercent ?? estimateAdultBodyFatPercent({
    age,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: latest.weightKg,
  })
  const source = latestMeasured?.bodyFatPercent === undefined ? 'estimated from BMI, age, and gender' : 'latest recorded'

  return (
    <section className="card body-fat-guide-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Body-fat guide</p>
          <h2>General adult target</h2>
          <p className="baseline-meta">{guide.label} · {source}</p>
        </div>
        <div className="body-fat-score"><strong>{currentBodyFat.toFixed(1)}%</strong><span>current</span></div>
      </div>
      <div className="body-fat-grid">
        <div><span>Low</span><strong>{guide.low.toFixed(1)}%</strong></div>
        <div><span>Suggested</span><strong>{guide.suggested.toFixed(1)}%</strong><button type="button" onClick={() => onSelectTarget(guide.suggested)}>Use goal</button></div>
        <div><span>High</span><strong>{guide.high.toFixed(1)}%</strong></div>
      </div>
      <p className="body-fat-copy">
        This is a screening guide, not a diagnosis. Body-fat estimates from BMI can be inaccurate for athletes, very muscular people, pregnancy, medical conditions, or unusual hydration status.
        {' '}<a href="https://inbodyusa.com/blogs/inbodyblog/body-fat-percentage-chart/" target="_blank" rel="noreferrer">Source: InBody body-fat percentage chart</a>.
      </p>
    </section>
  )
}

function Dashboard({ profile, state, setState, notify, backupDue, onBackup }: { profile: Profile; state: AppState; setState: (state: AppState) => void; notify: (message: string) => void; backupDue: boolean; onBackup: () => void }) {
  const [entryOpen, setEntryOpen] = useState(false)
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const entries = profile.entries
  const latest = entries.at(-1)
  const latestBodyFat = [...entries].reverse().find((entry) => entry.bodyFatPercent !== undefined)
  const first = entries[0]
  const hasToday = entries.some((entry) => entry.date === todayLocal())
  const change = latest && first ? latest.weightKg - first.weightKg : 0
  const remaining = latest ? latest.weightKg - profile.goalWeightKg : null
  const average7 = sevenDayAverage(entries)
  const weeklyChange = weeklyAverageChange(entries)
  const goalDate = estimateGoalDate(entries, profile.goalWeightKg)
  const progress = latest && first && first.weightKg !== profile.goalWeightKg
    ? Math.max(0, Math.min(100, ((first.weightKg - latest.weightKg) / (first.weightKg - profile.goalWeightKg)) * 100))
    : 0

  function saveEntry(date: string, weightKg: number, bodyFat?: number) {
    try {
      const next = addMeasurement(state, profile.id, createMeasurement({ date, weightKg, bodyFatPercent: bodyFat }))
      setState(next)
      setEntryOpen(false)
      notify('Measurement saved permanently.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the measurement.')
      setEntryOpen(false)
    }
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Your dashboard</p>
          <h1>Good day, {profile.name}</h1>
          <p>{latest ? `Last check-in ${formatDate(latest.date)}` : 'Start with your first morning measurement.'}</p>
        </div>
        <div className="welcome-actions">
          <button className="button secondary" onClick={() => setEditOpen(true)}>Edit Profile</button>
          <button className="button primary" disabled={hasToday} onClick={() => setEntryOpen(true)}>
            {hasToday ? 'Today is recorded' : 'Add Entry'}
          </button>
        </div>
      </section>

      {!hasToday && <div className="notice"><span aria-hidden="true">☀</span><span><strong>Morning check-in</strong> Weigh yourself after waking and before breakfast for a consistent trend.</span></div>}
      {backupDue && (
        <div className="notice backup-reminder">
          <span aria-hidden="true">↧</span>
          <span><strong>Backup reminder</strong> Keep a recent household backup before browser data gets cleared or you switch devices.</span>
          <button className="button compact secondary" type="button" onClick={onBackup}>Backup</button>
        </div>
      )}

      <section className="metric-grid" aria-label="Current progress summary">
        <article className="metric-card featured">
          <span>Current weight</span>
          <strong>{latest ? formatWeight(latest.weightKg, profile.preferredUnit) : '—'}</strong>
          <small>{latest ? `${change > 0 ? '+' : ''}${fromKilograms(change, profile.preferredUnit).toFixed(1)} ${profile.preferredUnit} since start` : 'No measurements yet'}</small>
        </article>
        <article className="metric-card">
          <span>Body fat</span>
          <strong>{latestBodyFat?.bodyFatPercent !== undefined ? `${latestBodyFat.bodyFatPercent.toFixed(1)}%` : '—'}</strong>
          <small>{profile.goalBodyFatPercent ? `Goal ${profile.goalBodyFatPercent.toFixed(1)}%` : 'No goal set'}</small>
        </article>
        <article className="metric-card">
          <span>Target weight</span>
          <strong>{formatWeight(profile.goalWeightKg, profile.preferredUnit)}</strong>
          <small>{remaining == null ? 'Ready when you are' : `${Math.abs(fromKilograms(remaining, profile.preferredUnit)).toFixed(1)} ${profile.preferredUnit} ${remaining >= 0 ? 'to go' : 'past goal'}`}</small>
        </article>
        <article className="metric-card">
          <span>7-day average</span>
          <strong>{average7 !== null ? formatWeight(average7, profile.preferredUnit) : '—'}</strong>
          <small>{weeklyChangeLabel(weeklyChange, profile.preferredUnit)}</small>
        </article>
      </section>

      <section className="metric-grid trend-grid" aria-label="Trend and goal summary">
        <article className="metric-card">
          <span>Goal progress</span>
          <strong>{Math.round(progress)}%</strong>
          <div className="progress-track" aria-label={`${Math.round(progress)} percent toward goal`}><span style={{ width: `${progress}%` }} /></div>
        </article>
        <article className="metric-card goal-estimate-card">
          <span>Goal estimate</span>
          <strong>{goalDate ? formatDate(goalDate) : 'Not enough trend yet'}</strong>
          <small>{goalDate ? 'At your current trend, this is an estimate only.' : 'Needs a consistent trend toward the target.'}</small>
        </article>
      </section>

      <ProfileSummaryCard profile={profile} />

      <BmiGuide profile={profile} onCompleteBaseline={() => setBaselineOpen(true)} onSelectTargetWeight={(goalWeightKg) => {
        setState(updateProfileSettings(state, profile.id, {
          preferredUnit: profile.preferredUnit,
          goalWeightKg,
          goalBodyFatPercent: profile.goalBodyFatPercent,
        }))
        notify('Target weight updated from the BMI guide.')
      }} />

      <BodyFatGuideCard profile={profile} onSelectTarget={(goalBodyFatPercent) => {
        setState(updateProfileSettings(state, profile.id, {
          preferredUnit: profile.preferredUnit,
          goalWeightKg: profile.goalWeightKg,
          goalBodyFatPercent,
        }))
        notify('Target body-fat goal updated from the guide.')
      }} />

      <ProgressChart profile={profile} />

      <div className="content-grid">
        <section className="card history-card">
          <div className="section-heading">
            <div><p className="eyebrow">History</p><h2>Recent measurements</h2></div>
            <button className="button compact secondary" disabled={!entries.length} onClick={() => exportProfileCsv(profile)}>Export CSV</button>
          </div>
          {entries.length ? (
            <div className="table-scroll"><table>
              <thead><tr><th>Date</th><th>Weight</th><th>Body fat</th></tr></thead>
              <tbody>{[...entries].reverse().slice(0, 8).map((entry) => (
                <tr key={entry.id}><td>{formatDate(entry.date)}</td><td>{formatWeight(entry.weightKg, profile.preferredUnit)}</td><td>{entry.bodyFatPercent !== undefined ? `${entry.bodyFatPercent.toFixed(1)}%` : '—'}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="empty-copy">No measurements recorded yet.</p>}
          <p className="immutable-note">Entries are permanent and cannot be edited or deleted.</p>
        </section>

        <section className="card settings-card">
          <div className="section-heading"><div><p className="eyebrow">Goals</p><h2>Preferences</h2></div></div>
          <SettingsForm profile={profile} onSave={(input) => {
            setState(updateProfileSettings(state, profile.id, input))
            notify('Goals and display preferences updated.')
          }} />
        </section>
      </div>

      {entryOpen && <Modal title="Add measurement" onClose={() => setEntryOpen(false)}><EntryForm profile={profile} onSave={saveEntry} onCancel={() => setEntryOpen(false)} /></Modal>}
      {editOpen && <Modal title="Edit Profile" onClose={() => setEditOpen(false)}><EditProfileForm profile={profile} onCancel={() => setEditOpen(false)} onSave={(input) => {
        try {
          setState(updateProfileDetails(state, profile.id, input))
          setEditOpen(false)
          notify('Profile updated.')
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Could not update the profile.')
        }
      }} /></Modal>}
      {baselineOpen && <Modal title="Complete profile baseline" onClose={() => setBaselineOpen(false)}><BaselineForm profile={profile} onCancel={() => setBaselineOpen(false)} onSubmit={(input) => {
        try {
          setState(completeProfileBaseline(state, profile.id, input))
          setBaselineOpen(false)
          notify('Baseline profile completed.')
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Could not save the baseline.')
        }
      }} /></Modal>}
    </>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [profileModal, setProfileModal] = useState(false)
  const [toast, setToast] = useState('')
  const [backupDue, setBackupDue] = useState(() => isBackupDue(window.localStorage.getItem(LAST_BACKUP_KEY)))
  const uploadInput = useRef<HTMLInputElement>(null)
  const activeProfile = useMemo(
    () => state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0],
    [state],
  )

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document.documentElement.style.colorScheme = state.theme === 'system' ? 'light dark' : state.theme
  }, [state.theme])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])
  function handleNewProfile(input: Parameters<typeof createProfile>[0]) {
    try {
      setState(addProfile(state, createProfile(input)))
      setProfileModal(false)
      setToast('Profile created.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not create the profile.')
    }
  }

  function handleBackupDownload() {
    exportAllJson(state)
    const timestamp = new Date().toISOString()
    window.localStorage.setItem(LAST_BACKUP_KEY, timestamp)
    setBackupDue(false)
    setToast('Backup downloaded.')
  }

  async function handleBackupUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5_000_000) {
      setToast('Backup file is too large.')
      return
    }
    try {
      const restored = restoreStateFromBackup(await file.text())
      if (!window.confirm(`Replace this browser’s current household with ${restored.profiles.length} restored profile${restored.profiles.length === 1 ? '' : 's'}?`)) return
      setState(restored)
      setToast('Household backup restored in this browser.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not restore this backup.')
    }
  }

  if (!activeProfile) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-card">
          <div className="brand-mark" aria-hidden="true">BA</div>
          <p className="eyebrow">Balik Alindog Tracker</p>
          <h1>Start your household’s health tracker.</h1>
          <p className="lead">Create the first person’s baseline. Existing profiles will appear automatically whenever this browser returns.</p>
          <ProfileForm onSubmit={handleNewProfile} />
          <div className="onboarding-restore">
            <span>Already have a household backup?</span>
            <button className="button secondary" onClick={() => uploadInput.current?.click()}>Upload backup</button>
            <input ref={uploadInput} className="sr-only" type="file" accept="application/json,.json" onChange={handleBackupUpload} tabIndex={-1} />
          </div>
          <p className="privacy-note">No account. No cloud. Household data stays in this browser and is never uploaded to the repository.</p>
        </section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Balik Alindog Tracker home"><span className="brand-mark small">BA</span><span>Balik Alindog</span></a>
        <div className="header-actions">
          <span className="household-label">Household</span>
          <label className="profile-select"><span className="sr-only">Active household member</span>
            <select value={activeProfile.id} onChange={(event) => setState({ ...state, activeProfileId: event.target.value })}>
              {state.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
          <button className="button compact secondary add-person" disabled={state.profiles.length >= MAX_PROFILES} onClick={() => setProfileModal(true)}><span aria-hidden="true">+</span><span className="add-person-text">Add person</span></button>
          <label className="theme-select"><span className="sr-only">Color theme</span>
            <select value={state.theme} onChange={(event) => setState(setTheme(state, event.target.value as Theme))}>
              <option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option>
            </select>
          </label>
          <button className="button compact secondary export-all" onClick={handleBackupDownload}>Backup</button>
          <button className="button compact secondary upload-backup" onClick={() => uploadInput.current?.click()}>Upload</button>
          <input ref={uploadInput} className="sr-only" type="file" accept="application/json,.json" onChange={handleBackupUpload} tabIndex={-1} />
        </div>
      </header>
      <main id="top" className="main-content">
        <Dashboard
          profile={activeProfile}
          state={state}
          setState={setState}
          notify={setToast}
          backupDue={backupDue}
          onBackup={handleBackupDownload}
        />
        <footer><span>Stored privately in this browser · never uploaded to the repository</span><span>•</span><span>{state.profiles.length} of {MAX_PROFILES} profiles</span><span>•</span><span>AI suggestions coming in a future release</span></footer>
      </main>
      {profileModal && <Modal title="Add a household member" onClose={() => setProfileModal(false)}><ProfileForm onSubmit={handleNewProfile} onCancel={() => setProfileModal(false)} /></Modal>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
