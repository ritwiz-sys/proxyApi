import { useQueries } from '@tanstack/react-query'
import api from '../api/axiosInstance.ts'
import type { City, CurrentWeather } from '../types.ts'
import type { TempUnit } from '../hooks/useUnit.ts'
import { formatTemp } from '../utils/temperature.ts'

interface ComparisonTableProps {
  cities: City[]
  unit: TempUnit
}

const fetchCurrentWeather = async (lat: number, lon: number): Promise<CurrentWeather> => {
  const { data } = await api.get<CurrentWeather>(
    `/api/weather/current?lat=${lat}&lon=${lon}`
  )
  return data
}

const ComparisonTable = ({ cities, unit }: ComparisonTableProps) => {
  const results = useQueries({
    queries: cities.map((city) => ({
      queryKey: ['weather', 'current', city.lat, city.lon],
      queryFn: () => fetchCurrentWeather(city.lat, city.lon),
      staleTime: 1000 * 60 * 5,
    })),
  })

  if (cities.length < 2) return null

  const temps = results.map((result) => result.data?.main.temp)
  const validTemps = temps.filter((temp): temp is number => typeof temp === 'number')
  const maxTemp = validTemps.length ? Math.max(...validTemps) : undefined
  const minTemp = validTemps.length ? Math.min(...validTemps) : undefined

  const tempClass = (temp: number | undefined) => {
    if (temp === undefined) return 'text-slate-400'
    if (maxTemp !== minTemp && temp === maxTemp) return 'font-bold text-red-400'
    if (maxTemp !== minTemp && temp === minTemp) return 'font-bold text-sky-400'
    return 'text-slate-100'
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/60">
      <table className="w-full min-w-[500px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="px-4 py-3 font-medium text-slate-400">Metric</th>
            {cities.map((city) => (
              <th key={city.id} className="px-4 py-3 font-medium text-slate-100">
                {city.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-700/60">
            <td className="px-4 py-3 text-slate-400">Temperature</td>
            {results.map((result, idx) => (
              <td key={cities[idx].id} className={`px-4 py-3 ${tempClass(result.data?.main.temp)}`}>
                {formatTemp(result.data?.main.temp, unit)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-700/60">
            <td className="px-4 py-3 text-slate-400">Feels Like</td>
            {results.map((result, idx) => (
              <td key={cities[idx].id} className="px-4 py-3 text-slate-100">
                {formatTemp(result.data?.main.feels_like, unit)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-700/60">
            <td className="px-4 py-3 text-slate-400">Humidity</td>
            {results.map((result, idx) => (
              <td key={cities[idx].id} className="px-4 py-3 text-slate-100">
                {result.data ? `${result.data.main.humidity}%` : '—'}
              </td>
            ))}
          </tr>
          <tr className="border-b border-slate-700/60">
            <td className="px-4 py-3 text-slate-400">Wind Speed</td>
            {results.map((result, idx) => (
              <td key={cities[idx].id} className="px-4 py-3 text-slate-100">
                {result.data ? `${result.data.wind.speed} m/s` : '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td className="px-4 py-3 text-slate-400">Description</td>
            {results.map((result, idx) => (
              <td key={cities[idx].id} className="px-4 py-3 capitalize text-slate-100">
                {result.data?.weather[0]?.description ?? '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default ComparisonTable
