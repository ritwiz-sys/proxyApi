import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

const app = express()

app.use(cors())
app.use(express.json())

const weatherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per window
  message: {
    error: 'Too many requests — slow down! Try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
})


const allowedIPs = [
  '127.0.0.1',   
  '::1',         
  
]

const ipRestriction = (req, res, next) => {
  const userIP = req.ip || req.connection.remoteAddress

  console.log('Request from IP:', userIP)

  if (!allowedIPs.includes(userIP)) {
    return res.status(403).json({
      error: 'Access denied — your IP is not allowed'
    })
  }

  next()
}

// Apply both middlewares to route
app.get('/api/weather', ipRestriction, weatherLimiter, async (req, res) => {
  const { city } = req.query

  if (!city) {
    return res.status(400).json({ error: 'City is required' })
  }

  try {
    const response = await fetch(
      `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${city}`
    )

    const data = await response.json()

    if (data.error) {
      return res.status(400).json({ error: data.error.info })
    }

    res.json(data)

  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})