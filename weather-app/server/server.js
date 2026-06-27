import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/weather', async (req, res) => {
  const { city } = req.query
  console.log('City received:', city)
  console.log('API Key exists:', !!process.env.WEATHERSTACK_API_KEY)

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