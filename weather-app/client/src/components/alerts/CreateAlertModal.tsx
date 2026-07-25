import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce.ts'
import api from '../../api/axiosInstance.ts'
import type { City } from '../../types.ts'

interface CreateAlertModalProps {
  onClose: () => void
  favCities: City[]
}

const CreateAlertModal = ({ onClose, favCities }: CreateAlertModalProps) => {

  // ─── State ───────────────────────────────────────
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formValues, setFormValues] = useState({
    temp_above: '',
    temp_below: '',
    aqi_above: '',
    humidity_above: '',
    wind_above: ''
  })

  // ─── Debounce ────────────────────────────────────
  const debouncedQuery = useDebounce(searchQuery, 300)

  // ─── City Search ─────────────────────────────────
  const { data: suggestions } = useQuery({
    queryKey: ['cities', 'search', debouncedQuery],
    queryFn: () => api.get(`/api/cities/search?q=${debouncedQuery}`),
    enabled: debouncedQuery.length >= 3
  })

  // ─── Create Alert Mutation ────────────────────────
  const queryClient = useQueryClient()
  const createAlert = useMutation({
    mutationFn: (alertData: Record<string, unknown>) =>
      api.post('/api/alerts', alertData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      onClose()
    }
  })

  // ─── Submit ──────────────────────────────────────
  const handleSubmit = () => {
    if (!selectedCity) return

    createAlert.mutate({
      city_name: selectedCity.name,
      country: selectedCity.country,
      lat: selectedCity.lat,
      lon: selectedCity.lon,
      temp_above: formValues.temp_above ? Number(formValues.temp_above) : null,
      temp_below: formValues.temp_below ? Number(formValues.temp_below) : null,
      aqi_above: formValues.aqi_above ? Number(formValues.aqi_above) : null,
      humidity_above: formValues.humidity_above ? Number(formValues.humidity_above) : null,
      wind_above: formValues.wind_above ? Number(formValues.wind_above) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100">
            {selectedCity ? '⚙️ Set Alert Conditions' : '🌍 Select a City'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-xl transition"
          >
            ✕
          </button>
        </div>

        {/* SCREEN 1 — City Selection */}
        {!selectedCity ? (
          <div className="space-y-4">

            {/* Search Input */}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any city..."
              className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            {/* Search Suggestions */}
            {suggestions?.data && suggestions.data.length > 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
                <p className="px-4 py-2 text-xs text-slate-400 border-b border-slate-700">
                  Search Results
                </p>
                {suggestions.data.map((city: any) => (
                  <button
                    key={`${city.lat}-${city.lon}`}
                    onClick={() => setSelectedCity({
                      id: `${city.name}-${city.country}`.toLowerCase(),
                      name: city.name,
                      country: city.country,
                      lat: city.lat,
                      lon: city.lon
                    })}
                    className="w-full text-left px-4 py-3 text-slate-200 hover:bg-slate-700 transition border-b border-slate-700 last:border-0"
                  >
                    📍 {city.name}, {city.country}
                  </button>
                ))}
              </div>
            )}

            {/* Fav Cities Quick Select */}
            {favCities.length > 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
                <p className="px-4 py-2 text-xs text-slate-400 border-b border-slate-700">
                  Your Favourite Cities
                </p>
                {favCities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => setSelectedCity(city)}
                    className="w-full text-left px-4 py-3 text-slate-200 hover:bg-slate-700 transition border-b border-slate-700 last:border-0"
                  >
                    ⭐ {city.name}, {city.country}
                  </button>
                ))}
              </div>
            )}

          </div>

        ) : (

          /* SCREEN 2 — Alert Form */
          <div className="space-y-4">

            {/* Selected City + Change */}
            <div className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-600 px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">Alert for</p>
                <p className="text-slate-100 font-semibold">
                  📍 {selectedCity.name}, {selectedCity.country}
                </p>
              </div>
              <button
                onClick={() => setSelectedCity(null)}
                className="text-xs text-sky-400 hover:text-sky-300 transition"
              >
                Change
              </button>
            </div>

            {/* Form hint */}
            <p className="text-xs text-slate-400">
              Fill in any condition — leave empty to skip
            </p>

            {/* Form Inputs */}
            <div className="space-y-3">
              {[
                { key: 'temp_above', label: 'Temperature Above', unit: '°C' },
                { key: 'temp_below', label: 'Temperature Below', unit: '°C' },
                { key: 'aqi_above', label: 'AQI Above', unit: '' },
                { key: 'humidity_above', label: 'Humidity Above', unit: '%' },
                { key: 'wind_above', label: 'Wind Speed Above', unit: 'km/h' },
              ].map(({ key, label, unit }) => (
                <div key={key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <label className="text-sm text-slate-300 sm:w-44 sm:shrink-0">
                    {label}
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={formValues[key as keyof typeof formValues]}
                      onChange={(e) => setFormValues({
                        ...formValues,
                        [key]: e.target.value
                      })}
                      placeholder="—"
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 pr-12"
                    />
                    {unit && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        {unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSubmit}
              disabled={createAlert.isPending}
              className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-3 font-semibold text-white transition mt-2"
            >
              {createAlert.isPending ? 'Saving...' : 'Save Alert 🔔'}
            </button>

            {/* Error */}
            {createAlert.isError && (
              <p className="text-red-400 text-sm text-center">
                Failed to create alert. Try again.
              </p>
            )}

          </div>
        )}

      </div>
    </div>
  )
}

export default CreateAlertModal