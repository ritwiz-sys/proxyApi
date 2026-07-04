import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Weather from './weather'
import api from '../api/axiosInstance'

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn() }
}))

const renderWithClient = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('Weather component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the search input and button', () => {
    renderWithClient(<Weather />)

    expect(screen.getByPlaceholderText('Enter city name...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('fetches and displays weather data when searching a city', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        location: { name: 'London', region: 'City of London', country: 'UK', localtime: '2026-07-04 10:00' },
        current: {
          temperature: 20,
          feelslike: 19,
          humidity: 60,
          wind_speed: 10,
          uv_index: 4,
          weather_descriptions: ['Sunny']
        }
      }
    })

    const user = userEvent.setup()
    renderWithClient(<Weather />)

    await user.type(screen.getByPlaceholderText('Enter city name...'), 'London')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => expect(screen.getByText('London')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/api/weather?city=London')
    expect(screen.getByText('Sunny')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    // mockRejectedValue (not "Once") — the component's useQuery has retry: 1,
    // so the mock must keep rejecting across the retry attempt too
    api.get.mockRejectedValue(new Error('Access denied'))

    const user = userEvent.setup()
    renderWithClient(<Weather />)

    await user.type(screen.getByPlaceholderText('Enter city name...'), 'Nowhere')
    await user.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => expect(screen.getByText('Access denied')).toBeInTheDocument())
  })

  it('does not trigger a search for an empty city', async () => {
    const user = userEvent.setup()
    renderWithClient(<Weather />)

    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(api.get).not.toHaveBeenCalled()
  })
})
