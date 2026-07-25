import { useQuery } from '@tanstack/react-query'
import api from '../../api/axiosInstance.ts'
import type { Alert } from '../../types.ts'

interface AlertCardProps {
  alert: Alert
  isEditMode: boolean
  onDelete: () => void
  onToggle: () => void
}

const AlertCard = ({ alert, isEditMode, onDelete, onToggle }: AlertCardProps) => {

  // fetch fresh weather for this city
  const { data: weather } = useQuery({
    queryKey: ['weather', 'current', alert.lat, alert.lon],
    queryFn: async () => {
      const res = await api.get(`/api/weather/current?lat=${alert.lat}&lon=${alert.lon}`)
      return res.data
    },
    staleTime: 1000 * 60 * 5
  })

  const currentTemp = weather?.main?.temp
  const currentHumidity = weather?.main?.humidity
  const currentWind = weather?.wind?.speed

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-3">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-100">
            📍 {alert.city_name}, {alert.country}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            alert.is_active
              ? 'bg-green-500/20 text-green-400'
              : 'bg-slate-600/40 text-slate-400'
          }`}>
            {alert.is_active ? 'Active' : 'Paused'}
          </span>
        </div>

        {/* Edit mode buttons */}
        {isEditMode && (
          <div className="flex gap-2">
            <button
              onClick={onToggle}
              className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition"
            >
              {alert.is_active ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={onDelete}
              className="text-xs px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="rounded-lg overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="text-left px-3 py-2 text-slate-400 font-medium">Condition</th>
              <th className="text-center px-3 py-2 text-slate-400 font-medium">Your Threshold</th>
              <th className="text-center px-3 py-2 text-slate-400 font-medium">Current</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">

            {/* Temperature Above */}
            {alert.temp_above && (
              <tr>
                <td className="px-3 py-2 text-slate-300">Temp Above</td>
                <td className="px-3 py-2 text-center text-sky-400">{alert.temp_above}°C</td>
                <td className={`px-3 py-2 text-center font-medium ${
                  currentTemp && currentTemp > alert.temp_above
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}>
                  {currentTemp ? `${currentTemp.toFixed(1)}°C` : '—'}
                </td>
              </tr>
            )}

            {/* Temperature Below */}
            {alert.temp_below && (
              <tr>
                <td className="px-3 py-2 text-slate-300">Temp Below</td>
                <td className="px-3 py-2 text-center text-sky-400">{alert.temp_below}°C</td>
                <td className={`px-3 py-2 text-center font-medium ${
                  currentTemp && currentTemp < alert.temp_below
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}>
                  {currentTemp ? `${currentTemp.toFixed(1)}°C` : '—'}
                </td>
              </tr>
            )}

            {/* Humidity */}
            {alert.humidity_above && (
              <tr>
                <td className="px-3 py-2 text-slate-300">Humidity Above</td>
                <td className="px-3 py-2 text-center text-sky-400">{alert.humidity_above}%</td>
                <td className={`px-3 py-2 text-center font-medium ${
                  currentHumidity && currentHumidity > alert.humidity_above
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}>
                  {currentHumidity ? `${currentHumidity}%` : '—'}
                </td>
              </tr>
            )}

            {/* Wind */}
            {alert.wind_above && (
              <tr>
                <td className="px-3 py-2 text-slate-300">Wind Above</td>
                <td className="px-3 py-2 text-center text-sky-400">{alert.wind_above} km/h</td>
                <td className={`px-3 py-2 text-center font-medium ${
                  currentWind && currentWind > alert.wind_above
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}>
                  {currentWind ? `${currentWind.toFixed(1)} km/h` : '—'}
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* Triggered badge */}
      {alert.is_triggered && (
        <div className="text-xs text-orange-400 bg-orange-400/10 rounded-lg px-3 py-2">
          ⚠️ Alert was triggered — check your email
        </div>
      )}

    </div>
  )
}

export default AlertCard