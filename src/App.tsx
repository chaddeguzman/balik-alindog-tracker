import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { ProgressChart } from './components/ProgressChart'
import { BaselineForm } from './components/BaselineForm'
import { BmiGuide } from './components/BmiGuide'
import { formatDate, todayLocal } from './lib/date'
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
  updateProfileSettings,
} from './lib/storage'
import { formatWeight, fromKilograms, toKilograms, unitRange } from './lib/units'
import type { AppState, Profile, Theme, Unit } from './types'

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
  const [date, setDate] = useState(todayLocal())
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
        <input type="date" required max={todayLocal()} value={date} onChange={(event) => setDate(event.target.value)} />
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

function Dashboard({ profile, state, setState, notify }: { profile: Profile; state: AppState; setState: (state: AppState) => void; notify: (message: string) => void }) {
  const [entryOpen, setEntryOpen] = useState(false)
  const [baselineOpen, setBaselineOpen] = useState(false)
  const entries = profile.entries
  const latest = entries.at(-1)
  const latestBodyFat = [...entries].reverse().find((entry) => entry.bodyFatPercent !== undefined)
  const first = entries[0]
  const hasToday = entries.some((entry) => entry.date === todayLocal())
  const change = latest && first ? latest.weightKg - first.weightKg : 0
  const remaining = latest ? latest.weightKg - profile.goalWeightKg : null
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
        <button className="button primary" disabled={hasToday} onClick={() => setEntryOpen(true)}>
          {hasToday ? 'Today is recorded' : '+ Add today’s measurement'}
        </button>
      </section>

      {!hasToday && <div className="notice"><span aria-hidden="true">☀</span><span><strong>Morning check-in</strong> Weigh yourself after waking and before breakfast for a consistent trend.</span></div>}

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
          <span>Goal progress</span>
          <strong>{Math.round(progress)}%</strong>
          <div className="progress-track" aria-label={`${Math.round(progress)} percent toward goal`}><span style={{ width: `${progress}%` }} /></div>
        </article>
      </section>

      <BmiGuide profile={profile} onCompleteBaseline={() => setBaselineOpen(true)} />

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
          <button className="button compact secondary export-all" onClick={() => exportAllJson(state)}>Backup</button>
          <button className="button compact secondary upload-backup" onClick={() => uploadInput.current?.click()}>Upload</button>
          <input ref={uploadInput} className="sr-only" type="file" accept="application/json,.json" onChange={handleBackupUpload} tabIndex={-1} />
        </div>
      </header>
      <main id="top" className="main-content">
        <Dashboard profile={activeProfile} state={state} setState={setState} notify={setToast} />
        <footer><span>Stored privately in this browser · never uploaded to the repository</span><span>•</span><span>{state.profiles.length} of {MAX_PROFILES} profiles</span><span>•</span><span>AI suggestions coming in a future release</span></footer>
      </main>
      {profileModal && <Modal title="Add a household member" onClose={() => setProfileModal(false)}><ProfileForm onSubmit={handleNewProfile} onCancel={() => setProfileModal(false)} /></Modal>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
