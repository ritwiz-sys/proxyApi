import { useQuery } from '@tanstack/react-query'
import api from '../api/axiosInstance.ts'
import type { City, CurrentWeather, ForecastDay } from '../types.ts'
import type { TempUnit } from '../hooks/useUnit.ts'
import { celsiusTo, formatTemp } from '../utils/temperature.ts'

interface CityCardProps {
  city: City
  onRemove: (id: string) => void
  unit: TempUnit
}

const fetchCurrentWeather = async (lat: number, lon: number): Promise<CurrentWeather> => {
  const { data } = await api.get<CurrentWeather>(
    `/api/weather/current?lat=${lat}&lon=${lon}`
  )
  return data
}

const fetchForecast = async (lat: number, lon: number): Promise<ForecastDay[]> => {
  const { data } = await api.get<ForecastDay[]>(
    `/api/weather/forecast?lat=${lat}&lon=${lon}`
  )
  return data
}

const dayName = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

const iconUrl = (icon: string) => `https://openweathermap.org/img/wn/${icon}@2x.png`

const relativeTime = (timestamp: number): string => {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

const CityCard = ({ city, onRemove, unit }: CityCardProps) => {
  const currentQuery = useQuery({
    queryKey: ['weather', 'current', city.lat, city.lon],
    queryFn: () => fetchCurrentWeather(city.lat, city.lon),
    staleTime: 1000 * 60 * 5,
  })

  const forecastQuery = useQuery({
    queryKey: ['weather', 'forecast', city.lat, city.lon],
    queryFn: () => fetchForecast(city.lat, city.lon),
    staleTime: 1000 * 60 * 30,
  })

  const handleRefresh = () => {
    currentQuery.refetch()
    forecastQuery.refetch()
  }

  const isLoading = currentQuery.isLoading || forecastQuery.isLoading
  const isError = currentQuery.isError || forecastQuery.isError

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{city.name}</h3>
          <p className="text-sm text-slate-400">{city.country}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh"
            className="rounded-lg border border-slate-600 p-2 text-slate-300 transition hover:bg-slate-700"
          >
            🔄
          </button>
          <button
            type="button"
            onClick={() => onRemove(city.id)}
            title="Remove"
            className="rounded-lg border border-slate-600 p-2 text-slate-300 transition hover:bg-red-900/50 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-4">
          <div className="h-16 rounded-lg bg-slate-700" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 rounded-lg bg-slate-700" />
            <div className="h-12 rounded-lg bg-slate-700" />
            <div className="h-12 rounded-lg bg-slate-700" />
          </div>
          <div className="h-20 rounded-lg bg-slate-700" />
        </div>
      )}

      {!isLoading && isError && (
        <div className="rounded-lg bg-red-900/30 p-3 text-center text-sm text-red-300">
          Failed to load weather data
        </div>
      )}

      {!isLoading && !isError && currentQuery.data && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-slate-100">
                {formatTemp(currentQuery.data.main.temp, unit)}
              </p>
              <p className="capitalize text-slate-400">
                {currentQuery.data.weather[0]?.description}
              </p>
            </div>
            {currentQuery.data.weather[0] && (
              <img
                src={iconUrl(currentQuery.data.weather[0].icon)}
                alt={currentQuery.data.weather[0].description}
                className="h-16 w-16"
              />
            )}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-900/50 p-2">
              <p className="text-xs text-slate-400">Feels Like</p>
              <p className="font-semibold text-slate-100">
                {formatTemp(currentQuery.data.main.feels_like, unit)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2">
              <p className="text-xs text-slate-400">Humidity</p>
              <p className="font-semibold text-slate-100">
                {currentQuery.data.main.humidity}%
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2">
              <p className="text-xs text-slate-400">Wind</p>
              <p className="font-semibold text-slate-100">
                {currentQuery.data.wind.speed} m/s
              </p>
            </div>
          </div>

          {forecastQuery.data && forecastQuery.data.length > 0 && (
            <div className="grid grid-cols-5 gap-1 border-t border-slate-700 pt-4">
              {forecastQuery.data.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-1 text-center">
                  <p className="text-xs text-slate-400">{dayName(day.date)}</p>
                  <img src={iconUrl(day.icon)} alt={day.description} className="h-8 w-8" />
                  <p className="text-xs text-slate-100">
                    <span className="font-semibold">
                      {Math.round(celsiusTo(day.maxTemp, unit))}°
                    </span>{' '}
                    <span className="text-slate-400">
                      {Math.round(celsiusTo(day.minTemp, unit))}°
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {currentQuery.dataUpdatedAt > 0 && (
            <p className="mt-4 text-center text-xs text-slate-500">
              Updated {relativeTime(currentQuery.dataUpdatedAt)}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default CityCard
