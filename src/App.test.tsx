import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { addMeasurement, addProfile, createMeasurement, createProfile, initialState, saveState } from './lib/storage'
import { formatDate, todayLocal } from './lib/date'

function createProfileWithTdee(
  input: Omit<Parameters<typeof createProfile>[0], 'activityLevel' | 'weeklyLossTargetKg'>
    & Partial<Pick<Parameters<typeof createProfile>[0], 'activityLevel' | 'weeklyLossTargetKg'>>,
) {
  return createProfile({
    activityLevel: 'moderate',
    weeklyLossTargetKg: 0.5,
    ...input,
  })
}

describe('Balik Alindog Tracker', () => {
  it('guides a new user through profile setup', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /start your household/i })).toBeInTheDocument()
    expect(screen.getByText(/existing profiles will appear automatically/i)).toBeInTheDocument()
  })

  it('creates a profile and displays its dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/profile name/i), 'Mika')
    await user.selectOptions(screen.getByLabelText(/gender/i), 'female')
    await user.type(screen.getByLabelText(/birthday/i), '1992-05-10')
    await user.type(screen.getByLabelText(/current height \(cm\)/i), '165')
    await user.type(screen.getByLabelText(/current weight \(kg\)/i), '72')
    await user.type(screen.getByLabelText(/target weight \(kg\)/i), '65')
    await user.selectOptions(screen.getByLabelText(/activity level/i), 'moderate')
    await user.click(screen.getByRole('button', { name: /create profile & baseline/i }))
    expect(await screen.findByRole('heading', { name: /good day, mika/i })).toBeInTheDocument()
    expect(screen.getAllByText('65.0 kg').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: /a general guide/i })).toBeInTheDocument()
    expect(screen.getByText(/general healthy-weight range/i)).toBeInTheDocument()
  })

  it('opens an existing household and keeps the add-person option visible', () => {
    const existing = createProfileWithTdee({
      name: 'Jamie',
      preferredUnit: 'kg',
      heightCm: 168,
      birthDate: '1984-03-20',
      gender: 'male',
      currentWeightKg: 76,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByRole('heading', { name: /good day, jamie/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add person/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/active household member/i)).toHaveValue(existing.id)
  })

  it('opens profile details from the greeting name', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Jamie',
      preferredUnit: 'kg',
      heightCm: 168,
      birthDate: '1984-03-20',
      gender: 'male',
      currentWeightKg: 76,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)
    expect(screen.queryByLabelText(/profile summary/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Jamie' }))
    const dialog = screen.getByRole('dialog', { name: 'Jamie' })

    expect(within(dialog).getByText('168 cm')).toBeInTheDocument()
    expect(within(dialog).getByText('Male')).toBeInTheDocument()
    expect(within(dialog).getByText('68.0 kg')).toBeInTheDocument()
  })

  it('edits profile details from the dashboard', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Jamie',
      preferredUnit: 'kg',
      heightCm: 168,
      birthDate: '1984-03-20',
      gender: 'male',
      currentWeightKg: 76,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)
    await user.click(screen.getByRole('button', { name: /edit profile/i }))
    const dialog = screen.getByRole('dialog', { name: /edit profile/i })
    const nameInput = within(dialog).getByLabelText(/profile name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Jamie D')
    await user.click(within(dialog).getByRole('button', { name: /save profile/i }))

    expect(await screen.findByRole('heading', { name: /good day, jamie d/i })).toBeInTheDocument()
  })

  it('enables add entry on a fresh date and disables it after saving today', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Kai',
      preferredUnit: 'kg',
      heightCm: 170,
      birthDate: '1990-01-15',
      gender: 'male',
      currentWeightKg: 80,
      goalWeightKg: 70,
    })
    existing.entries[0] = { ...existing.entries[0], date: '2000-01-01' }
    saveState(addProfile(initialState, existing))

    render(<App />)
    const addEntry = screen.getByRole('button', { name: /add entry/i })
    expect(addEntry).toBeEnabled()

    await user.click(addEntry)
    const dialog = screen.getByRole('dialog', { name: /add measurement/i })
    expect(within(dialog).getByLabelText(/measurement date/i)).toHaveValue(todayLocal())
    await user.type(within(dialog).getByLabelText(/weight \(kg\)/i), '79')
    await user.click(within(dialog).getByRole('button', { name: /review entry/i }))
    await user.click(within(dialog).getByRole('button', { name: /save entry/i }))

    expect(await screen.findByRole('button', { name: /today is recorded/i })).toBeDisabled()
  })

  it('edits a saved entry once from history', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Kai',
      preferredUnit: 'kg',
      heightCm: 170,
      birthDate: '1990-01-15',
      gender: 'male',
      currentWeightKg: 80,
      goalWeightKg: 70,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)
    await user.click(screen.getByRole('button', { name: /edit entry/i }))
    const dialog = screen.getByRole('dialog', { name: /edit entry/i })
    const weightInput = within(dialog).getByLabelText(/weight \(kg\)/i)
    await user.clear(weightInput)
    await user.type(weightInput, '79.4')
    await user.click(within(dialog).getByRole('button', { name: /review edit/i }))
    await user.click(within(dialog).getByRole('button', { name: /save edit/i }))

    expect(await screen.findByText(/measurement edit saved/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edited/i })).toBeDisabled()
    expect(screen.getAllByText('79.4 kg').length).toBeGreaterThanOrEqual(1)
  })

  it('only allows editing today and pages history five entries at a time', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Kai',
      preferredUnit: 'kg',
      heightCm: 170,
      birthDate: '1990-01-15',
      gender: 'male',
      currentWeightKg: 80,
      goalWeightKg: 70,
    })
    let state = addProfile(initialState, existing)
    for (let day = 1; day <= 6; day += 1) {
      state = addMeasurement(state, existing.id, createMeasurement({ date: `2026-01-0${day}`, weightKg: 86 - day }))
    }
    saveState(state)

    render(<App />)

    expect(screen.getAllByRole('button', { name: /edit entry/i })).toHaveLength(1)
    expect(screen.getAllByText(formatDate(todayLocal())).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(formatDate('2026-01-01'))).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show older entries/i }))

    expect(screen.queryByRole('button', { name: /edit entry/i })).not.toBeInTheDocument()
    expect(screen.getByText(formatDate('2026-01-01'))).toBeInTheDocument()
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument()
  })

  it('shows a sample forecast in the progress chart', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Ria',
      preferredUnit: 'kg',
      heightCm: 165,
      birthDate: '1992-05-10',
      gender: 'female',
      currentWeightKg: 80,
      goalWeightKg: 68,
    })
    existing.entries[0] = { ...existing.entries[0], date: '2026-01-01' }
    saveState(addProfile(initialState, existing))

    render(<App />)
    await user.click(screen.getByRole('button', { name: /sample/i }))

    expect(screen.getByText(/sample forecast/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /sample forecast progress graph/i })).toBeInTheDocument()
  })

  it('uses month-based actual chart ranges', () => {
    const existing = createProfileWithTdee({
      name: 'Ria',
      preferredUnit: 'kg',
      heightCm: 165,
      birthDate: '1992-05-10',
      gender: 'female',
      currentWeightKg: 80,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByRole('button', { name: /3m/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /6m/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /all/i })).not.toBeInTheDocument()
  })

  it('shows adult body-fat guidance and can set the suggested goal', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Ria',
      preferredUnit: 'kg',
      heightCm: 165,
      birthDate: '1992-05-10',
      gender: 'female',
      currentWeightKg: 80,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByRole('heading', { name: /general adult target/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /use goal/i }))
    expect(await screen.findByText(/target body-fat goal updated/i)).toBeInTheDocument()
  })

  it('adds a reusable food from the shared Calorie Tracker tab', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Ria',
      preferredUnit: 'kg',
      heightCm: 165,
      birthDate: '1992-05-10',
      gender: 'female',
      currentWeightKg: 80,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)
    await user.click(screen.getByRole('tab', { name: /calorie tracker/i }))
    expect(screen.getByRole('heading', { name: /calorie tracker/i })).toBeInTheDocument()
    expect(screen.getByText(/shared household library/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add food$/i }))
    const dialog = screen.getByRole('dialog', { name: /add food/i })
    await user.type(within(dialog).getByLabelText(/^food$/i), 'Chicken Adobo')
    await user.selectOptions(within(dialog).getByLabelText(/category/i), 'food')
    await user.type(within(dialog).getByLabelText(/^calorie$/i), '240')
    await user.type(within(dialog).getByLabelText(/weight \(grams\)/i), '150')
    await user.selectOptions(within(dialog).getByLabelText(/meal type/i), 'lunch')
    await user.type(within(dialog).getByLabelText(/remarks/i), 'Household recipe')
    await user.click(within(dialog).getByRole('button', { name: /^add food$/i }))

    expect(await screen.findByText('Chicken Adobo')).toBeInTheDocument()
    expect(screen.getByText('240 kcal')).toBeInTheDocument()
    expect(screen.getByText('150 g')).toBeInTheDocument()
    expect(screen.getByText('Lunch')).toBeInTheDocument()
  })

  it('shows an adult daily calorie estimate from profile TDEE settings', () => {
    const existing = createProfileWithTdee({
      name: 'Alex',
      preferredUnit: 'kg',
      heightCm: 175,
      birthDate: '1990-01-15',
      gender: 'male',
      currentWeightKg: 80,
      goalWeightKg: 70,
      activityLevel: 'moderate',
      weeklyLossTargetKg: 0.5,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByText(/estimated daily calorie target/i)).toBeInTheDocument()
    expect(screen.getByText(/moderate.*0\.5 kg\/week/i)).toBeInTheDocument()
  })

  it('prompts migrated profiles to complete TDEE settings', async () => {
    const user = userEvent.setup()
    const existing = createProfileWithTdee({
      name: 'Jamie',
      preferredUnit: 'kg',
      heightCm: 168,
      birthDate: '1984-03-20',
      gender: 'male',
      currentWeightKg: 76,
      goalWeightKg: 68,
    })
    delete existing.activityLevel
    delete existing.weeklyLossTargetKg
    saveState(addProfile(initialState, existing))

    render(<App />)
    await user.click(screen.getByRole('button', { name: /complete tdee settings/i }))

    const dialog = screen.getByRole('dialog', { name: /edit profile/i })
    expect(within(dialog).getByLabelText(/activity level/i)).toHaveValue('')
    expect(within(dialog).getByRole('slider', { name: /weekly loss target/i })).toHaveValue('0.5')
  })

  it('does not calculate an adult TDEE target for a younger profile', () => {
    const existing = createProfileWithTdee({
      name: 'Young profile',
      preferredUnit: 'kg',
      heightCm: 160,
      birthDate: '2010-01-15',
      gender: 'female',
      currentWeightKg: 55,
      goalWeightKg: 50,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByText(/adults 20\+ only/i)).toBeInTheDocument()
  })

  it('shows a prominent warning without clamping a low positive estimate', () => {
    const existing = createProfileWithTdee({
      name: 'Low estimate',
      preferredUnit: 'kg',
      heightCm: 165,
      birthDate: '1990-01-15',
      gender: 'female',
      currentWeightKg: 60,
      goalWeightKg: 55,
      activityLevel: 'sedentary',
      weeklyLossTargetKg: 0.9,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(/below 1,200 kcal\/day is not advised/i)
    expect(screen.getByText(/sedentary.*0\.9 kg\/week/i)).toBeInTheDocument()
  })
})
