import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { addProfile, createProfile, initialState, saveState } from './lib/storage'

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
    await user.type(screen.getByLabelText(/current age/i), '34')
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
      age: 42,
      gender: 'prefer-not-to-say',
      currentWeightKg: 76,
      goalWeightKg: 68,
    })
    saveState(addProfile(initialState, existing))

    render(<App />)

    expect(screen.getByRole('heading', { name: /good day, jamie/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add person/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/active household member/i)).toHaveValue(existing.id)
  })
})
