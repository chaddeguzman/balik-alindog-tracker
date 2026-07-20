import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ProfileForm } from './components/ProfileForm'
import { ProgressChart } from './components/ProgressChart'
import { BaselineForm } from './components/BaselineForm'
import { BmiGuide } from './components/BmiGuide'
import { CalorieTracker } from './components/CalorieTracker'
import { TdeeSettingsFields } from './components/TdeeSettingsFields'
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
  updateMeasurement,
  updateProfileDetails,
  updateProfileSettings,
} from './lib/storage'
import { estimateGoalDate, sevenDayAverage, weeklyAverageChange } from './lib/trends'
import { ACTIVITY_LABELS, calculateProfileTdee } from './lib/tdee'
import { centimetersFromFeet, formatHeight, formatWeight, fromKilograms, toKilograms, unitRange } from './lib/units'
import { addHealthMemory, extractHealthMemoryCommand, sendHealthChatMessage } from './lib/healthTrackApi'
import type { ActivityLevel, AppState, FoodLibraryEntry, Gender, Measurement, Profile, Unit } from './types'

const LAST_BACKUP_KEY = 'balik-alindog-tracker:last-backup-at'
const BACKUP_REMINDER_DAYS = 14
const HISTORY_PAGE_SIZE = 5

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

function EntryForm({
  profile,
  entry,
  onSave,
  onCancel,
}: {
  profile: Profile
  entry?: Measurement
  onSave: (date: string, weightKg: number, bodyFat?: number) => void
  onCancel: () => void
}) {
  const unit = profile.preferredUnit
  const date = entry?.date ?? todayLocal()
  const [weight, setWeight] = useState(entry ? fromKilograms(entry.weightKg, unit).toFixed(1) : '')
  const [bodyFat, setBodyFat] = useState(entry?.bodyFatPercent?.toString() ?? '')
  const [confirming, setConfirming] = useState(false)
  const range = unitRange(unit)
  const weightKg = toKilograms(Number(weight), unit)
  const isEditing = Boolean(entry)

  function review(event: FormEvent) {
    event.preventDefault()
    setConfirming(true)
  }

  if (confirming) {
    return (
      <div className="confirmation">
        <div className="notice warning">
          <strong>Check this entry carefully.</strong>
          <span>{isEditing ? 'This entry can only be edited once.' : 'After saving, the entry can be edited one time.'}</span>
        </div>
        <dl className="confirmation-list">
          <div><dt>Date</dt><dd>{formatDate(date)}</dd></div>
          <div><dt>Weight</dt><dd>{Number(weight).toFixed(1)} {unit}</dd></div>
          <div><dt>Body fat</dt><dd>{bodyFat ? `${Number(bodyFat).toFixed(1)}%` : 'Not recorded'}</dd></div>
        </dl>
        <div className="form-actions">
          <button className="button secondary" onClick={() => setConfirming(false)}>Go back</button>
          <button className="button primary" onClick={() => onSave(date, weightKg, bodyFat ? Number(bodyFat) : undefined)}>{isEditing ? 'Save edit' : 'Save entry'}</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={review} className="form-stack">
      <p className="helper-text">{isEditing ? 'Correct the saved values for this measurement day.' : 'For consistent results, record in the morning before eating or drinking.'}</p>
      <label>
        Measurement date
        <input type="date" readOnly value={date} />
        <small className="field-note">{isEditing ? 'Measurement dates stay fixed when editing.' : "Captured from this device's system date."}</small>
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
        <button className="button primary" type="submit">{isEditing ? 'Review edit' : 'Review entry'}</button>
      </div>
    </form>
  )
}

function EditProfileForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile
  onSave: (input: {
    name: string
    heightCm: number
    birthDate: string
    gender: Gender
    activityLevel: ActivityLevel
    weeklyLossTargetKg: number
  }) => void
  onCancel: () => void
}) {
  const totalInches = profile.heightCm ? profile.heightCm / 2.54 : 0
  const [name, setName] = useState(profile.name)
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const [gender, setGender] = useState<Gender | ''>(profile.gender ?? '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>(profile.activityLevel ?? '')
  const [weeklyLossTargetKg, setWeeklyLossTargetKg] = useState(profile.weeklyLossTargetKg ?? 0.5)
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
      activityLevel: activityLevel as ActivityLevel,
      weeklyLossTargetKg,
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
      <div className="form-section-heading">
        <span>+</span>
        <div><h3>Daily calorie estimate</h3><p>Required for the adult Dashboard TDEE target.</p></div>
      </div>
      <TdeeSettingsFields
        activityLevel={activityLevel}
        weeklyLossTargetKg={weeklyLossTargetKg}
        onActivityLevelChange={setActivityLevel}
        onWeeklyLossTargetChange={setWeeklyLossTargetKg}
      />
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

function ProfileDetails({ profile }: { profile: Profile }) {
  const latest = profile.entries.at(-1)
  const baseline = profile.entries.find((entry) => entry.id === profile.baselineEntryId) ?? profile.entries[0]

  return (
    <div className="profile-details">
      <p className="helper-text">Profile details and current progress for this household member.</p>
      <dl className="profile-summary-grid">
        <div><dt>Height</dt><dd>{profile.heightCm ? formatHeight(profile.heightCm, profile.preferredUnit) : 'Missing'}</dd></div>
        <div><dt>Age</dt><dd>{profile.birthDate ? calculateAge(profile.birthDate) : 'Missing'}</dd></div>
        <div><dt>Gender</dt><dd>{genderLabel(profile.gender)}</dd></div>
        <div><dt>Activity</dt><dd>{profile.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] : 'Not configured'}</dd></div>
        <div><dt>Weekly loss</dt><dd>{profile.weeklyLossTargetKg === undefined ? 'Not configured' : `${profile.weeklyLossTargetKg.toFixed(1)} kg`}</dd></div>
        <div><dt>Starting</dt><dd>{baseline ? formatWeight(baseline.weightKg, profile.preferredUnit) : 'Missing'}</dd></div>
        <div><dt>Current</dt><dd>{latest ? formatWeight(latest.weightKg, profile.preferredUnit) : 'Missing'}</dd></div>
        <div><dt>Target</dt><dd>{formatWeight(profile.goalWeightKg, profile.preferredUnit)}</dd></div>
      </dl>
    </div>
  )
}

interface HealthChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  isError?: boolean
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const tokenPattern = /(\*\*[^*]+\*\*|\+\+[^+]+\+\+|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${match.index}`

    if (token.startsWith('**')) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('++')) nodes.push(<u key={key}>{token.slice(2, -2)}</u>)
    else if (token.startsWith('*')) nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
      nodes.push(link ? <a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a> : token)
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function renderHealthChatMarkdown(text: string): ReactNode {
  const lines = text.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (!listItems.length) return
    const items = listItems
    listItems = []
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {items.map((item, index) => <li key={index}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>)}
      </ul>,
    )
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      return
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/)
    if (listItem) {
      listItems.push(listItem[1])
      return
    }

    flushList()
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const HeadingTag = `h${Math.min(heading[1].length + 2, 4)}` as 'h3' | 'h4'
      blocks.push(<HeadingTag key={`heading-${index}`}>{renderInlineMarkdown(heading[2], `heading-${index}`)}</HeadingTag>)
      return
    }

    blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(trimmed, `paragraph-${index}`)}</p>)
  })

  flushList()
  return <div className="health-chat-markdown">{blocks}</div>
}

function HealthChat({ profile, foodLibrary }: { profile: Profile; foodLibrary: FoodLibraryEntry[] }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<HealthChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hi ${profile.name}. I can help you understand your tracker trends and build sustainable habits.`,
    },
  ])
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, open])

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const userText = input.trim()
    if (!userText || sending) return

    setInput('')
    setSending(true)
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: userText }])

    try {
      const memoryText = extractHealthMemoryCommand(userText)
      const reply = memoryText
        ? addHealthMemory(memoryText) && `I'll remember: ${memoryText}`
        : await sendHealthChatMessage(userText, profile, { foodLibrary })
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: reply || 'I could not generate a response. Please try again.' }])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: error instanceof Error ? error.message : 'Health chat is unavailable right now. Please try again later.',
          isError: true,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <aside className={`health-chat ${open ? 'is-open' : ''}`} aria-label="Health chat assistant">
      <button className="health-chat-toggle" type="button" aria-expanded={open} aria-controls="health-chat-panel" onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">♥</span>
        <span className="sr-only">Open health chat</span>
      </button>
      <section id="health-chat-panel" className="health-chat-panel" hidden={!open}>
        <div className="health-chat-header">
          <div>
            <p className="eyebrow">Health chat</p>
            <h2>Wellness coach</h2>
          </div>
        </div>
        <p className="health-chat-disclaimer">
          Not medical advice. Messages may include {profile.name}'s tracker history and the shared household food library for context.
        </p>
        <div ref={messagesRef} className="health-chat-messages" aria-live="polite" aria-busy={sending}>
          {messages.map((message) => (
            <div key={message.id} className={`health-chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${message.isError ? 'is-error' : ''}`}>
              {message.role === 'assistant' ? renderHealthChatMarkdown(message.text) : message.text}
            </div>
          ))}
          {sending && <div className="health-chat-message assistant-message is-loading">Thinking...</div>}
        </div>
        <form className="health-chat-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="health-chat-input">Message health chat</label>
          <textarea
            id="health-chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              if (event.altKey) {
                event.preventDefault()
                const field = event.currentTarget
                const start = field.selectionStart
                const end = field.selectionEnd
                const next = `${input.slice(0, start)}\n${input.slice(end)}`
                setInput(next)
                window.requestAnimationFrame(() => {
                  field.selectionStart = start + 1
                  field.selectionEnd = start + 1
                })
                return
              }
              if (event.shiftKey || event.ctrlKey || event.metaKey) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            placeholder="Ask about your progress..."
            rows={2}
            disabled={sending}
          />
          <button className="button primary compact" type="submit" disabled={sending || !input.trim()}>Send</button>
        </form>
      </section>
    </aside>
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
        <span className="guide-source">
          Source: <a href="https://inbodyusa.com/blogs/inbodyblog/body-fat-percentage-chart/" target="_blank" rel="noreferrer">https://inbodyusa.com/blogs/inbodyblog/body-fat-percentage-chart/</a>
        </span>
      </p>
    </section>
  )
}

function TdeeMetricCard({
  profile,
  onConfigure,
}: {
  profile: Profile
  onConfigure: () => void
}) {
  const estimate = calculateProfileTdee(profile)
  let value = 'Unavailable'
  let detail = 'Complete profile measurements first.'

  if (estimate.status === 'ready') {
    value = `${estimate.roundedDailyTargetCalories?.toLocaleString()} kcal`
    detail = `${ACTIVITY_LABELS[profile.activityLevel!]} · ${profile.weeklyLossTargetKg?.toFixed(1)} kg/week`
  } else if (estimate.status === 'underage') {
    value = 'Adults 20+ only'
    detail = 'Younger profiles need age-specific professional guidance.'
  } else if (estimate.status === 'underweight') {
    value = 'Weight-loss target unavailable'
    detail = 'Weight-loss targets are not shown below BMI 18.5.'
  } else if (estimate.status === 'goal-reached') {
    value = 'Goal reached'
    detail = 'A calorie deficit is not suggested at or below goal weight.'
  } else if (estimate.status === 'not-viable') {
    value = 'Target not viable'
    detail = 'The selected pace produces a zero or negative calorie estimate.'
  }

  return (
    <article className={`metric-card tdee-metric-card ${estimate.belowMinimum ? 'is-warning' : ''}`}>
      <span>Estimated daily calorie target</span>
      {estimate.status === 'missing-settings' ? (
        <>
          <strong className="metric-status">Setup needed</strong>
          <button className="button compact secondary tdee-setup-button" type="button" onClick={onConfigure}>Complete TDEE settings</button>
        </>
      ) : (
        <>
          <strong className={estimate.status === 'ready' ? '' : 'metric-status'}>{value}</strong>
          <small>{detail}</small>
        </>
      )}
    </article>
  )
}

function Dashboard({ profile, state, setState, notify, backupDue, onBackup }: { profile: Profile; state: AppState; setState: (state: AppState) => void; notify: (message: string) => void; backupDue: boolean; onBackup: () => void }) {
  const [entryOpen, setEntryOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Measurement | null>(null)
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)
  const entries = profile.entries
  const today = todayLocal()
  const sortedHistory = [...entries].reverse()
  const historyPageCount = Math.max(1, Math.ceil(sortedHistory.length / HISTORY_PAGE_SIZE))
  const currentHistoryPage = Math.min(historyPage, historyPageCount - 1)
  const visibleHistory = sortedHistory.slice(currentHistoryPage * HISTORY_PAGE_SIZE, (currentHistoryPage + 1) * HISTORY_PAGE_SIZE)
  const latest = entries.at(-1)
  const latestBodyFat = [...entries].reverse().find((entry) => entry.bodyFatPercent !== undefined)
  const first = entries[0]
  const hasToday = entries.some((entry) => entry.date === today)
  const change = latest && first ? latest.weightKg - first.weightKg : 0
  const remaining = latest ? latest.weightKg - profile.goalWeightKg : null
  const average7 = sevenDayAverage(entries)
  const weeklyChange = weeklyAverageChange(entries)
  const goalDate = estimateGoalDate(entries, profile.goalWeightKg)
  const tdeeEstimate = calculateProfileTdee(profile)
  const progress = latest && first && first.weightKg !== profile.goalWeightKg
    ? Math.max(0, Math.min(100, ((first.weightKg - latest.weightKg) / (first.weightKg - profile.goalWeightKg)) * 100))
    : 0

  function saveEntry(date: string, weightKg: number, bodyFat?: number) {
    try {
      const next = addMeasurement(state, profile.id, createMeasurement({ date, weightKg, bodyFatPercent: bodyFat }))
      setState(next)
      setEntryOpen(false)
      setHistoryPage(0)
      notify('Measurement saved.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the measurement.')
      setEntryOpen(false)
    }
  }

  function saveEntryEdit(_date: string, weightKg: number, bodyFat?: number) {
    if (!editingEntry) return
    try {
      const next = updateMeasurement(state, profile.id, editingEntry.id, { weightKg, bodyFatPercent: bodyFat })
      setState(next)
      setEditingEntry(null)
      notify('Measurement edit saved.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not edit the measurement.')
      setEditingEntry(null)
    }
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Your dashboard</p>
          <h1>
            Good day,{' '}
            <button className="profile-name-button" type="button" onClick={() => setProfileDetailsOpen(true)}>
              {profile.name}
            </button>
          </h1>
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
        <TdeeMetricCard profile={profile} onConfigure={() => setEditOpen(true)} />
      </section>

      {tdeeEstimate.status === 'ready' && tdeeEstimate.belowMinimum && (
        <div className="notice warning tdee-warning" role="alert">
          <strong>Very low calorie estimate</strong>
          <span>
            The selected settings calculate approximately {tdeeEstimate.roundedDailyTargetCalories?.toLocaleString()} kcal/day.
            Intake below 1,200 kcal/day is not advised without guidance from a qualified health professional.
          </span>
        </div>
      )}
      {tdeeEstimate.status === 'ready' && (
        <p className="tdee-disclaimer">
          This is a static estimate, not medical advice. It is not intended for pregnancy, breastfeeding, relevant medical conditions, or individualized athletic nutrition.
        </p>
      )}

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
              <thead><tr><th>Date</th><th>Weight</th><th>Body fat</th><th>Action</th></tr></thead>
              <tbody>{visibleHistory.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.date)}</td>
                  <td>{formatWeight(entry.weightKg, profile.preferredUnit)}</td>
                  <td>{entry.bodyFatPercent !== undefined ? `${entry.bodyFatPercent.toFixed(1)}%` : '—'}</td>
                  <td>
                    {entry.date === today ? (
                      <button className="button compact secondary" type="button" disabled={Boolean(entry.editedAt)} onClick={() => setEditingEntry(entry)}>
                        {entry.editedAt ? 'Edited' : 'Edit Entry'}
                      </button>
                    ) : (
                      <span className="history-action-empty">—</span>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <p className="empty-copy">No measurements recorded yet.</p>}
          {entries.length > HISTORY_PAGE_SIZE && (
            <div className="history-pagination" aria-label="Measurement history pages">
              <button className="button compact secondary" type="button" disabled={currentHistoryPage === 0} onClick={() => setHistoryPage((page) => Math.max(0, page - 1))} aria-label="Show newer entries">←</button>
              <span>Page {currentHistoryPage + 1} of {historyPageCount}</span>
              <button className="button compact secondary" type="button" disabled={currentHistoryPage >= historyPageCount - 1} onClick={() => setHistoryPage((page) => Math.min(historyPageCount - 1, page + 1))} aria-label="Show older entries">→</button>
            </div>
          )}
          <p className="immutable-note">Only today's entry can be edited, and only once. Older measurement dates stay locked.</p>
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
      {editingEntry && <Modal title="Edit Entry" onClose={() => setEditingEntry(null)}><EntryForm profile={profile} entry={editingEntry} onSave={saveEntryEdit} onCancel={() => setEditingEntry(null)} /></Modal>}
      {profileDetailsOpen && <Modal title={profile.name} onClose={() => setProfileDetailsOpen(false)}><ProfileDetails profile={profile} /></Modal>}
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
  const [activeTab, setActiveTab] = useState<'overview' | 'calorie-tracker'>('overview')
  const [profileModal, setProfileModal] = useState(false)
  const [toast, setToast] = useState('')
  const [backupDue, setBackupDue] = useState(() => isBackupDue(window.localStorage.getItem(LAST_BACKUP_KEY)))
  const uploadInput = useRef<HTMLInputElement>(null)
  const activeProfile = useMemo(
    () => state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0],
    [state],
  )
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDarkTheme = state.theme === 'dark' || (state.theme === 'system' && prefersDark)

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

  function toggleTheme() {
    setState(setTheme(state, isDarkTheme ? 'light' : 'dark'))
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
          <button
            className="theme-toggle"
            id="themeToggle"
            type="button"
            aria-label="Toggle light/dark mode"
            aria-pressed={isDarkTheme}
            onClick={toggleTheme}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb">
                <span className="theme-toggle-icon theme-toggle-icon--dark">🌙</span>
                <span className="theme-toggle-icon theme-toggle-icon--light">☀️</span>
              </span>
            </span>
          </button>
          <button className="button compact secondary export-all" onClick={handleBackupDownload}>Backup</button>
          <button className="button compact secondary upload-backup" onClick={() => uploadInput.current?.click()}>Upload</button>
          <input ref={uploadInput} className="sr-only" type="file" accept="application/json,.json" onChange={handleBackupUpload} tabIndex={-1} />
        </div>
      </header>
      <main id="top" className="main-content">
        <nav className="app-tabs" role="tablist" aria-label="Tracker views">
          <button
            id="overview-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            aria-controls="overview-panel"
            onClick={() => setActiveTab('overview')}
          >
            Dashboard
          </button>
          <button
            id="calorie-tracker-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'calorie-tracker'}
            aria-controls="calorie-tracker-panel"
            onClick={() => setActiveTab('calorie-tracker')}
          >
            Calorie Tracker
          </button>
        </nav>
        {activeTab === 'overview' ? (
          <div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab">
            <Dashboard
              profile={activeProfile}
              state={state}
              setState={setState}
              notify={setToast}
              backupDue={backupDue}
              onBackup={handleBackupDownload}
            />
          </div>
        ) : (
          <div id="calorie-tracker-panel" role="tabpanel" aria-labelledby="calorie-tracker-tab">
            <CalorieTracker state={state} setState={setState} notify={setToast} />
          </div>
        )}
        <footer><span>Stored privately in this browser · never uploaded to the repository</span><span>•</span><span>{state.profiles.length} of {MAX_PROFILES} profiles</span><span>•</span><span>Health chat uses the active profile only</span></footer>
      </main>
      <HealthChat key={activeProfile.id} profile={activeProfile} foodLibrary={state.foodLibrary} />
      {profileModal && <Modal title="Add a household member" onClose={() => setProfileModal(false)}><ProfileForm onSubmit={handleNewProfile} onCancel={() => setProfileModal(false)} /></Modal>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
