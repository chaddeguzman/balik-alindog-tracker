import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Balik Alindog Tracker', () => {
  it('guides a new user through profile setup', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /build an honest picture/i })).toBeInTheDocument()
    expect(screen.getByText(/your data stays in this browser/i)).toBeInTheDocument()
  })

  it('creates a profile and displays its dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/profile name/i), 'Mika')
    await user.type(screen.getByLabelText(/target weight \(kg\)/i), '65')
    await user.click(screen.getByRole('button', { name: /create profile/i }))
    expect(await screen.findByRole('heading', { name: /good day, mika/i })).toBeInTheDocument()
    expect(screen.getByText('65.0 kg')).toBeInTheDocument()
  })
})
