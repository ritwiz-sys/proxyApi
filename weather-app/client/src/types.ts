export interface City {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  addedAt: number
}

export interface CitySearchResult {
  name: string
  country: string
  state?: string
  lat: number
  lon: number
}

export interface CurrentWeather {
  name: string
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

export interface AuthUser {
  id: string
  email: string
  username: string
}

export interface FavoriteCity {
  id: string
  city_name: string
  country: string
  lat: number
  lon: number
  added_at: string
}
