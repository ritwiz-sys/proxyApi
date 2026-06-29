import { useState } from 'react'
import api from '../api/axiosInstance'

const Weather = () => {
  const [city, setCity] = useState('')
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getWeather = async () => {
    if (!city.trim()) {
      setError('Please enter a city name')
      return
    }

    setLoading(true)
    setError('')
    setWeather(null)

    try {
      // axios instance — clean, no base URL needed
      const { data } = await api.get(`/api/weather?city=${city}`)
      setWeather(data)

    } catch (err) {
      // error message from interceptor or axios
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') getWeather()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">
          Weather App 🌤️
        </h1>

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
            onClick={getWeather}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-semibold"
          >
            Search
          </button>
        </div>

        {loading && (
          <div className="text-center text-blue-600 font-medium">
            Fetching weather... ⏳
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 font-medium bg-red-50 rounded-xl p-3">
            {error}
          </div>
        )}

        {weather && (
          <div className="bg-blue-50 rounded-xl p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-900">
                {weather.location.name}
              </h2>
              <p className="text-gray-500 text-sm">
                {weather.location.region}, {weather.location.country}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {weather.location.localtime}
              </p>
            </div>

            <div className="text-center">
              <span className="text-6xl font-bold text-blue-700">
                {weather.current.temperature}°
              </span>
              <span className="text-2xl text-blue-500">C</span>
              <p className="text-gray-600 mt-1">
                {weather.current.weather_descriptions[0]}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">Feels Like</p>
                <p className="text-blue-700 font-bold text-lg">
                  {weather.current.feelslike}°C
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">Humidity</p>
                <p className="text-blue-700 font-bold text-lg">
                  {weather.current.humidity}%
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">Wind Speed</p>
                <p className="text-blue-700 font-bold text-lg">
                  {weather.current.wind_speed} km/h
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-gray-400 text-xs">UV Index</p>
                <p className="text-blue-700 font-bold text-lg">
                  {weather.current.uv_index}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Weather