import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { addProfile, createProfile, initialState, saveState } from './lib/storage'
import { todayLocal } from './lib/date'

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
    await user.click(screen.getByRole('button', { name: /create profile & baseline/i }))
    expect(await screen.findByRole('heading', { name: /good day, mika/i })).toBeInTheDocument()
    expect(screen.getAllByText('65.0 kg').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: /a general guide/i })).toBeInTheDocument()
    expect(screen.getByText(/general healthy-weight range/i)).toBeInTheDocument()
  })

  it('opens an existing household and keeps the add-person option visible', () => {
    const existing = createProfile({
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

  it('edits profile details from the dashboard', async () => {
    const user = userEvent.setup()
    const existing = createProfile({
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
    const existing = createProfile({
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
    await user.click(within(dialog).getByRole('button', { name: /save permanently/i }))

    expect(await screen.findByRole('button', { name: /today is recorded/i })).toBeDisabled()
  })

  it('shows a sample forecast in the progress chart', async () => {
    const user = userEvent.setup()
    const existing = createProfile({
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
})
