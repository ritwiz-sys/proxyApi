import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import axios from 'axios'

const app = express()

app.use(cors())
app.use(express.json())

const weatherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
  message: { error: 'Too many requests — try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const allowedIPs = ['127.0.0.1', '::1']

const ipRestriction = (req, res, next) => {
  const rawIP = req.ip || req.connection.remoteAddress || ''
  // Node listens dual-stack by default, so IPv4 clients show up as
  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1) — normalize before comparing
  const userIP = rawIP.replace('::ffff:', '')
  console.log('Request from IP:', userIP)

  if (!allowedIPs.includes(userIP)) {
    return res.status(403).json({ error: 'Access denied' })
  }
  next()
}

app.get('/api/weather', ipRestriction, weatherLimiter, async (req, res) => {
  const { city } = req.query

  if (!city) {
    return res.status(400).json({ error: 'City is required' })
  }

  try {
    // debug — see exact URL being called
    console.log(
      'Calling URL:',
      `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${city}`
    )

    // replaced params with manual URL
    const { data } = await axios.get(
      `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${city}`
    )

    console.log('Weatherstack response:', JSON.stringify(data))

    if (data.error) {
      return res.status(400).json({ error: data.error.info })
    }

    res.json(data)
  } catch (error) {
    console.error('Weatherstack error:', error.message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
