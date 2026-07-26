import cron from 'node-cron'
import axios from 'axios'
import supabase from '../lib/supabase.js'
import { sendAlertEmail } from '../lib/mailer.js'

export const checkAlerts = async () => {
  console.log('Checking alerts...')

  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*, users(email)')
    .eq('is_active', true)

  if (error || !alerts) return

  for (const alert of alerts) {
    try {
      const { data: weather } = await axios.get(
        'https://api.openweathermap.org/data/2.5/weather',
        {
          params: {
            lat: alert.lat,
            lon: alert.lon,
            appid: process.env.OPENWEATHER_API_KEY,
            units: 'metric'
          }
        }
      )

      const { data: airData } = await axios.get(
        'https://api.openweathermap.org/data/2.5/air_pollution',
        {
          params: {
            lat: alert.lat,
            lon: alert.lon,
            appid: process.env.OPENWEATHER_API_KEY
          }
        }
      )

      const currentTemp = weather.main.temp
      const currentHumidity = weather.main.humidity
      const currentWind = weather.wind.speed
      const currentAqi = airData.list[0].main.aqi

      let triggered = false
      let condition = ''
      let value = 0

      if (alert.temp_above && currentTemp > alert.temp_above) {
        triggered = true
        condition = `Temperature above ${alert.temp_above}°C`
        value = currentTemp
      }

      if (alert.temp_below && currentTemp < alert.temp_below) {
        triggered = true
        condition = `Temperature below ${alert.temp_below}°C`
        value = currentTemp
      }

      if (alert.humidity_above && currentHumidity > alert.humidity_above) {
        triggered = true
        condition = `Humidity above ${alert.humidity_above}%`
        value = currentHumidity
      }

      if (alert.wind_above && currentWind > alert.wind_above) {
        triggered = true
        condition = `Wind speed above ${alert.wind_above} km/h`
        value = currentWind
      }

      if (alert.aqi_above && currentAqi > alert.aqi_above) {
        triggered = true
        condition = `AQI above ${alert.aqi_above}`
        value = currentAqi
      }

      if (triggered) {
        await sendAlertEmail(
          alert.users.email,
          alert.city_name,
          condition,
          value
        )

        await supabase
          .from('alerts')
          .update({ is_triggered: true, last_checked: new Date().toISOString() })
          .eq('id', alert.id)
      } else {
        await supabase
          .from('alerts')
          .update({ last_checked: new Date().toISOString() })
          .eq('id', alert.id)
      }

    } catch (error) {
      console.error(`Failed to check alert ${alert.id}:`, error)
    }
  }

  console.log('Alert check complete ✅')
}

// Start cron job
cron.schedule('*/30 * * * *', checkAlerts)