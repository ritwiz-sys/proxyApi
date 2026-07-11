import dotenv from 'dotenv'
dotenv.config()

import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import axios from 'axios'

const app = express()

app.use(cors())
app.use(express.json())

const weatherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests — try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
})

const citySearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests — try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
})

const allowedIPs = ['127.0.0.1', '::1']

const ipRestriction = (req: Request, res: Response, next: NextFunction) => {
  const rawIP = req.ip || req.socket.remoteAddress || ''
  // Node listens dual-stack by default, so IPv4 clients show up as
  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1) — normalize before comparing
  const userIP = rawIP.replace('::ffff:', '')
  console.log('Request from IP:', userIP)

  if (!allowedIPs.includes(userIP)) {
    res.status(403).json({ error: 'Access denied' })
    return
  }
  next()
}

interface WeatherstackError {
  error: {
    code: number
    type: string
    info: string
  }
}

interface WeatherstackSuccess {
  location: {
    name: string
    region: string
    country: string
    localtime: string
  }
  current: {
    temperature: number
    feelslike: number
    humidity: number
    wind_speed: number
    uv_index: number
    weather_descriptions: string[]
  }
}

type WeatherstackResponse = WeatherstackSuccess | WeatherstackError

app.get('/api/weather', ipRestriction, weatherLimiter, async (req: Request, res: Response) => {
  const city = req.query.city as string | undefined

  if (!city) {
    res.status(400).json({ error: 'City is required' })
    return
  }

  try {
    // debug — see exact URL being called
    console.log('Calling URL:', `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${city}`)

    // replaced params with manual URL
    const { data } = await axios.get<WeatherstackResponse>(
      `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${city}`
    )

    console.log('Weatherstack response:', JSON.stringify(data))

    if ('error' in data) {
      res.status(400).json({ error: data.error.info })
      return
    }

    res.json(data)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Weatherstack error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

interface GeoCodingResult {
  name: string
  local_names?: Record<string, string>
  lat: number
  lon: number
  country: string
  state?: string
}

interface OpenWeatherCurrentResponse {
  weather: Array<{
    id: number
    main: string
    description: string
    icon: string
  }>
  main: {
    temp: number
    feels_like: number
    temp_min: number
    temp_max: number
    humidity: number
  }
  wind: {
    speed: number
  }
  name: string
  sys: {
    country: string
  }
}

interface OpenWeatherForecastEntry {
  dt: number
  main: {
    temp: number
    temp_min: number
    temp_max: number
  }
  weather: Array<{
    main: string
    description: string
    icon: string
  }>
  dt_txt: string
}

interface OpenWeatherForecastResponse {
  cod: string
  list: OpenWeatherForecastEntry[]
}

app.get('/api/cities/search', ipRestriction, citySearchLimiter, async (req: Request, res: Response) => {
  const query = req.query.q as string | undefined

  if (!query || query.trim().length === 0) {
    res.status(400).json({ error: 'Search query is required' })
    return
  }

  try {
    const { data } = await axios.get<GeoCodingResult[]>(
      'https://api.openweathermap.org/geo/1.0/direct',
      {
        params: {
          q: query,
          limit: 5,
          appid: process.env.OPENWEATHER_API_KEY
        }
      }
    )

    const cities = data.map((result) => ({
      name: result.name,
      country: result.country,
      state: result.state,
      lat: result.lat,
      lon: result.lon
    }))

    res.json(cities)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Geocoding error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.get('/api/weather/current', ipRestriction, weatherLimiter, async (req: Request, res: Response) => {
  const lat = req.query.lat as string | undefined
  const lon = req.query.lon as string | undefined

  if (!lat || !lon) {
    res.status(400).json({ error: 'lat and lon are required' })
    return
  }

  try {
    const { data } = await axios.get<OpenWeatherCurrentResponse>(
      'https://api.openweathermap.org/data/2.5/weather',
      {
        params: {
          lat,
          lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric'
        }
      }
    )

    res.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Current weather error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.get('/api/weather/forecast', ipRestriction, weatherLimiter, async (req: Request, res: Response) => {
  const lat = req.query.lat as string | undefined
  const lon = req.query.lon as string | undefined

  if (!lat || !lon) {
    res.status(400).json({ error: 'lat and lon are required' })
    return
  }

  try {
    const { data } = await axios.get<OpenWeatherForecastResponse>(
      'https://api.openweathermap.org/data/2.5/forecast',
      {
        params: {
          lat,
          lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric'
        }
      }
    )

    // group the 3-hour entries by calendar day, and pick the entry closest
    // to midday as the representative icon/description for that day while
    // taking min/max temps across every entry seen that day
    const dayMap = new Map<string, { minTemp: number; maxTemp: number; entry: OpenWeatherForecastEntry }>()

    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0]
      const hour = Number(item.dt_txt.split(' ')[1].split(':')[0])
      const existing = dayMap.get(date)

      if (!existing) {
        dayMap.set(date, { minTemp: item.main.temp_min, maxTemp: item.main.temp_max, entry: item })
        continue
      }

      existing.minTemp = Math.min(existing.minTemp, item.main.temp_min)
      existing.maxTemp = Math.max(existing.maxTemp, item.main.temp_max)

      const currentHourDiff = Math.abs(Number(existing.entry.dt_txt.split(' ')[1].split(':')[0]) - 12)
      const newHourDiff = Math.abs(hour - 12)
      if (newHourDiff < currentHourDiff) {
        existing.entry = item
      }
    }

    const forecast = Array.from(dayMap.entries())
      .slice(0, 5)
      .map(([date, { minTemp, maxTemp, entry }]) => ({
        date,
        minTemp: Math.round(minTemp),
        maxTemp: Math.round(maxTemp),
        icon: entry.weather[0]?.icon ?? '01d',
        description: entry.weather[0]?.description ?? ''
      }))

    res.json(forecast)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Forecast error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

const PORT = Number(process.env.PORT) || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
