export interface City {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  addedAt?: number
<<<<<<< HEAD
=======
}

export interface FavoriteCity {
  id: string
  user_id: string
  city_name: string
  country: string
  lat: number
  lon: number
  added_at: string
}

export interface AuthUser {
  id: string
  email: string
  username: string
>>>>>>> main
}


export interface FavoriteCity {
  id: string
  user_id: string
  city_name: string
  country: string
  lat: number
  lon: number
  added_at: string
}

export interface AuthUser {
  id: string
  email: string
  username: string
}

export interface CitySearchResult {
  name: string
  country: string
  state?: string
  lat: number
  lon: number
}

export interface CurrentWeather {
  main: {
    temp: number
    feels_like: number
    humidity: number
    temp_min: number
    temp_max: number
  }
  wind: {
    speed: number
  }
  weather: Array<{
    main: string
    description: string
    icon: string
  }>
  name: string
  sys: {
    country: string
  }
}

export interface ForecastDay {
  date: string
  minTemp: number
  maxTemp: number
  icon: string
  description: string
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

export interface User {
  id: string
  email: string
  username: string
}