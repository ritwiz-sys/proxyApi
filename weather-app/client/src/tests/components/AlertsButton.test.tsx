import { render, screen, fireEvent } from '@testing-library/react'
import AlertsButton from '../../components/alerts/AlertsButton'
import {vi} from "vitest"
import {describe, test, expect} from "vitest"

describe('AlertsButton', () => {

  test('renders Alerts button', () => {
    render(<AlertsButton onCreateAlert={vi.fn()} onCheckAlerts={vi.fn()} />)
    expect(screen.getByText('Alerts 🔔')).toBeInTheDocument()
  })

  test('dropdown hidden by default', () => {
    render(<AlertsButton onCreateAlert={vi.fn()} onCheckAlerts={vi.fn()} />)
    expect(screen.queryByText('Create Alert')).toBeFalsy()
    expect(screen.queryByText('Check Alerts')).toBeFalsy()
  })

  test('shows dropdown when button clicked', () => {
    render(<AlertsButton onCreateAlert={vi.fn()} onCheckAlerts={vi.fn()} />)
    fireEvent.click(screen.getByText('Alerts 🔔')) // ← fill this
    expect(screen.getByText('Create Alert')).toBeInTheDocument()
    expect(screen.getByText('Check Alerts')).toBeInTheDocument()
  })

  test('calls onCreateAlert when Create Alert clicked', () => {
    const onCreateAlert = vi.fn()
    render(<AlertsButton onCreateAlert={onCreateAlert} onCheckAlerts={vi.fn()} />)
    fireEvent.click(screen.getByText('Alerts 🔔'))
    fireEvent.click(screen.getByText('Create Alert'))
    expect(onCreateAlert).toHaveBeenCalled()
  })

  test('closes dropdown after selection', () => {
    const onCreateAlert = vi.fn()
    render(<AlertsButton onCreateAlert={onCreateAlert} onCheckAlerts={vi.fn()} />)
    fireEvent.click(screen.getByText('Alerts 🔔'))
    fireEvent.click(screen.getByText('Create Alert'))
    expect(screen.queryByText('Create Alert')).toBeFalsy()
  })

})