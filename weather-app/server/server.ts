import './env.js'

import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import axios from 'axios'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import supabase from './lib/supabase.js'
import { authenticate } from './middleware/auth.js'

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

const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 2,
  message: { error: 'Too many attempts — try again after 15 minutes.' },
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

app.post('/api/auth/signup', ipRestriction, authLimiter, async (req: Request, res: Response) => {
  const { email, username, password } = req.body as {
    email?: string
    username?: string
    password?: string
  }

  if (!email || !username || !password) {
    res.status(400).json({ error: 'Email, username, and password are required' })
    return
  }

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Invalid email format' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, username, password: hashedPassword })
      .select('id, email, username')
      .single()

    if (error || !user) {
      console.error('Signup insert error:', error?.message)
      res.status(500).json({ error: 'Something went wrong' })
      return
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    res.status(201).json({ token, user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Signup error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.post('/api/auth/login', ipRestriction, authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, username, password')
      .eq('email', email)
      .maybeSingle()

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const passwordMatches = await bcrypt.compare(password, user.password)

    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid password' })
      return
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    res.json({ token, user: { id: user.id, email: user.email, username: user.username } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Login error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.get('/api/auth/me', ipRestriction, authenticate, (req: Request, res: Response) => {
  res.json(req.user)
})

app.get('/api/cities/favorites', ipRestriction, authenticate, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('favorite_cities')
      .select('id, city_name, country, lat, lon, added_at')
      .eq('user_id', req.user!.id)
      .order('added_at', { ascending: true })

    if (error) {
      console.error('Fetch favorites error:', error.message)
      res.status(500).json({ error: 'Something went wrong' })
      return
    }

    res.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fetch favorites error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.post('/api/cities/favorites', ipRestriction, authenticate, async (req: Request, res: Response) => {
  const { city_name, country, lat, lon } = req.body as {
    city_name?: string
    country?: string
    lat?: number
    lon?: number
  }

  if (!city_name || !country || typeof lat !== 'number' || typeof lon !== 'number') {
    res.status(400).json({ error: 'city_name, country, lat, and lon are required' })
    return
  }

  try {
    const { data: existing } = await supabase
      .from('favorite_cities')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('lat', lat)
      .eq('lon', lon)
      .maybeSingle()

    if (existing) {
      res.status(409).json({ error: 'City already in favorites' })
      return
    }

    const { data: city, error } = await supabase
      .from('favorite_cities')
      .insert({ user_id: req.user!.id, city_name, country, lat, lon })
      .select('id, city_name, country, lat, lon, added_at')
      .single()

    if (error || !city) {
      console.error('Add favorite error:', error?.message)
      res.status(500).json({ error: 'Something went wrong' })
      return
    }

    res.status(201).json(city)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Add favorite error:', message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.delete(
  '/api/cities/favorites/:id',
  ipRestriction,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('favorite_cities')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user!.id)
        .select('id')

      if (error) {
        console.error('Remove favorite error:', error.message)
        res.status(500).json({ error: 'Something went wrong' })
        return
      }

      if (!data || data.length === 0) {
        res.status(404).json({ error: 'City not found' })
        return
      }

      res.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Remove favorite error:', message)
      res.status(500).json({ error: 'Something went wrong' })
    }
  }
)

const PORT = Number(process.env.PORT) || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
