import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axiosInstance'

// fetch function — outside component (important)
const fetchWeather = async (city) => {
  const { data } = await api.get(`/api/weather?city=${city}`)
  return data
}

const Weather = () => {
  const [city, setCity] = useState('')
  const [searchCity, setSearchCity] = useState('') // actual search trigger

  // React Query handles everything
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['weather', searchCity],  // unique key per city
    queryFn: () => fetchWeather(searchCity),
    enabled: !!searchCity,  // only fetch when searchCity is set
    staleTime: 1000 * 60 * 5, // cache for 5 mins
    retry: 1
  })

  const handleSearch = () => {
    if (!city.trim()) return
    setSearchCity(city) // triggers the query
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">

        <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">
          Weather App 🌤️
        </h1>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter city name..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-semibold"
          >
            Search
          </button>
        </div>

        {/* Loading — React Query provides this automatically */}
        {isLoading && (
          <div className="text-center text-blue-600 font-medium">
            Fetching weather... ⏳
          </div>
        )}

        {/* Error — React Query provides this automatically */}
        {error && (
          <div className="text-center text-red-500 font-medium bg-red-50 rounded-xl p-3">
            {error.message || 'Something went wrong'}
          </div>
        )}

        {/* Weather Data — React Query provides this automatically */}
        {data && (
          <div className="bg-blue-50 rounded-xl p-6 space-y-4">

            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-900">
                {data.location.name}
              </h2>
              <p className="text-gray-500 text-sm">
                {data.location.region}, {data.location.country}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {data.location.localtime}
              </p>
            </div>

            <div className="text-center">
              <span className="text-6xl font-bold text-blue-700">
                {data.current.temperature}°
              </span>
              <span className="text-2xl text-blue-500">C</span>
              <p className="text-gray-600 mt-1">
                {data.current.weather_descriptions[0]}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">Feels Like</p>
                <p className="text-blue-700 font-bold text-lg">
                  {data.current.feelslike}°C
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">Humidity</p>
                <p className="text-blue-700 font-bold text-lg">
                  {data.current.humidity}%
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">Wind Speed</p>
                <p className="text-blue-700 font-bold text-lg">
                  {data.current.wind_speed} km/h
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">UV Index</p>
                <p className="text-blue-700 font-bold text-lg">
                  {data.current.uv_index}
                </p>
              </div>
            </div>

            {/* Refetch button — React Query makes this easy */}
            <button
              onClick={() => refetch()}
              className="w-full bg-blue-100 text-blue-700 py-2 rounded-xl hover:bg-blue-200 transition text-sm font-medium"
            >
              🔄 Refresh
            </button>

          </div>
        )}

      </div>
    </div>
  )
}

export default Weather