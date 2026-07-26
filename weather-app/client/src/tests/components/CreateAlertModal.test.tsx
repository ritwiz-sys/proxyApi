import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CreateAlertModal from '../../components/alerts/CreateAlertModal'
import { vi, describe, test, expect } from 'vitest'
import type { City } from '../../types'

vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} })
  }
}))

const mockCities: City[] = [
  { id: 'london-uk', name: 'London', country: 'UK', lat: 51.5, lon: -0.1 }
]

const renderModal = (favCities = mockCities) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateAlertModal onClose={vi.fn()} favCities={favCities} />
    </QueryClientProvider>
  )
}

describe('CreateAlertModal', () => {

  test('shows city selection screen by default', () => {
    renderModal()
    expect(screen.getByText(/Select a City/i)).toBeInTheDocument()
  })

  test('shows fav cities list', () => {
    renderModal()
    expect(screen.getByText(/London/)).toBeInTheDocument()
  })

  test('shows search input', () => {
    renderModal()
    expect(screen.getByPlaceholderText(/Search any city/i)).toBeInTheDocument()
  })

  test('switches to form after city selected', () => {
    renderModal()
    fireEvent.click(screen.getByText(/London/))
    expect(screen.getByText(/Set Alert Conditions/i)).toBeInTheDocument()
  })

  test('shows all condition inputs after city selected', () => {
    renderModal()
    fireEvent.click(screen.getByText(/London/))
    expect(screen.getByText('Temperature Above')).toBeInTheDocument()
    expect(screen.getByText('Temperature Below')).toBeInTheDocument()
    expect(screen.getByText('AQI Above')).toBeInTheDocument()
    expect(screen.getByText('Humidity Above')).toBeInTheDocument()
    expect(screen.getByText('Wind Speed Above')).toBeInTheDocument()
  })

  test('shows Change city button after selection', () => {
    renderModal()
    fireEvent.click(screen.getByText(/London/))
    expect(screen.getByText('Change')).toBeInTheDocument()
  })

  test('goes back to city selection when Change clicked', () => {
    renderModal()
    fireEvent.click(screen.getByText(/London/))
    fireEvent.click(screen.getByText('Change'))
    expect(screen.getByText(/Select a City/i)).toBeInTheDocument()
  })

  test('shows Save Alert button', () => {
    renderModal()
    fireEvent.click(screen.getByText(/London/))
    expect(screen.getByText(/Save Alert/i)).toBeInTheDocument()
  })

  test('calls onClose when ✕ clicked', () => {
    const onClose = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    render(
      <QueryClientProvider client={queryClient}>
        <CreateAlertModal onClose={onClose} favCities={mockCities} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

})