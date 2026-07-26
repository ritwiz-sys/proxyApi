import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AlertCard from '../../components/alerts/AlertCard'
import type { Alert } from '../../types'
import { vi, describe, test, expect } from 'vitest'

// mock api
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        main: { temp: 30, humidity: 80 },
        wind: { speed: 20 }
      }
    })
  }
}))

const mockAlert: Alert = {
  id: '123',
  user_id: 'user1',
  city_name: 'London',
  country: 'UK',
  lat: 51.5,
  lon: -0.1,
  temp_above: 25,
  temp_below: null,
  aqi_above: null,
  humidity_above: null,
  wind_above: null,
  is_triggered: false,
  is_active: true,
  last_checked: null,
  created_at: new Date().toISOString()
}

const renderAlertCard = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AlertCard
        alert={mockAlert}
        isEditMode={false}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  )
}

describe('AlertCard', () => {

  test('renders city name and country', () => {
    renderAlertCard()
    expect(screen.getByText(/London/)).toBeInTheDocument()
    expect(screen.getByText(/UK/)).toBeInTheDocument()
  })

  test('shows Active status when is_active true', () => {
    renderAlertCard()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  test('shows Paused status when is_active false', () => {
    renderAlertCard({ alert: { ...mockAlert, is_active: false } })
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  test('shows temp_above threshold in table', () => {
    renderAlertCard()
    expect(screen.getByText('25°C')).toBeInTheDocument()
  })

  test('hides edit buttons when not in edit mode', () => {
    renderAlertCard({ isEditMode: false })
    expect(screen.queryByText('Pause')).toBeFalsy()
    expect(screen.queryByText('Delete')).toBeFalsy()
  })

  test('shows edit buttons in edit mode', () => {
    renderAlertCard({ isEditMode: true })
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  test('shows triggered badge when alert triggered', () => {
    renderAlertCard({ alert: { ...mockAlert, is_triggered: true } })
    expect(screen.getByText(/triggered/i)).toBeInTheDocument()
  })

})