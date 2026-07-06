import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import Weather from './weather'
import api from '../api/axiosInstance'

// Weather uses useQuery, so every story needs its own QueryClientProvider —
// a shared client would leak cached results between stories.
const withQueryClient = Story => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  )
}

const sampleWeather = {
  location: {
    name: 'London',
    region: 'City of London, Greater London',
    country: 'United Kingdom',
    localtime: '2026-07-04 12:00',
  },
  current: {
    temperature: 21,
    feelslike: 20,
    humidity: 55,
    wind_speed: 14,
    uv_index: 5,
    weather_descriptions: ['Partly cloudy'],
  },
}

export default {
  title: 'Weather',
  component: Weather,
  decorators: [withQueryClient],
  parameters: { layout: 'fullscreen' },
}

// No API mock needed — nothing has been searched yet.
export const Empty = {}

export const Loaded = {
  play: async ({ canvasElement }) => {
    api.get = async () => ({ data: sampleWeather })

    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByPlaceholderText('Enter city name...'),
      'London'
    )
    await userEvent.click(canvas.getByRole('button', { name: /search/i }))

    await waitFor(() => expect(canvas.getByText('London')).toBeInTheDocument())
    await expect(canvas.getByText('Partly cloudy')).toBeInTheDocument()
  },
}

export const ErrorState = {
  play: async ({ canvasElement }) => {
    api.get = async () => {
      throw new Error('Access denied')
    }

    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByPlaceholderText('Enter city name...'),
      'Nowhere'
    )
    await userEvent.click(canvas.getByRole('button', { name: /search/i }))

    // react-query's retry: 1 means a second attempt (with its ~1s backoff
    // delay) happens before the error actually surfaces, so the default
    // waitFor timeout (1000ms) is too tight and this can flake — give it
    // more room.
    await waitFor(
      () => expect(canvas.getByText('Access denied')).toBeInTheDocument(),
      {
        timeout: 5000,
      }
    )
  },
}
