export interface City {
  id: string
  name: string
  country: string
  lat: number
  lon: number
}

export interface User {
  id: string
  email: string
  username: string
}

export interface Alert {
  id: string
  user_id: string
  city_name: string
  country: string
  lat: number
  lon: number
  temp_above: number | null
  temp_below: number | null
  aqi_above: number | null
  humidity_above: number | null
  wind_above: number | null
  is_triggered: boolean
  is_active: boolean
  last_checked: string | null
  created_at: string
}