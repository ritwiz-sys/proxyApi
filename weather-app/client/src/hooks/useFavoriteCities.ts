import { useEffect, useRef, useState } from 'react'
import api from '../api/axiosInstance.ts'
import { toCityId } from '../utils/city.ts'
import type { City, FavoriteCity } from '../types.ts'

const STORAGE_KEY = 'dashboard_cities'

const loadLocalCities = (): City[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as City[]) : []
  } catch {
    return []
  }
}

const saveLocalCities = (cities: City[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cities))
}

const toCity = (row: FavoriteCity): City => ({
  id: toCityId(row.city_name, row.country),
  name: row.city_name,
  country: row.country,
  lat: row.lat,
  lon: row.lon,
  addedAt: new Date(row.added_at).getTime(),
})

export function useFavoriteCities(isAuthenticated: boolean) {
  const [cities, setCities] = useState<City[]>(() => loadLocalCities())
  // maps the client-side slug id (e.g. "london-gb") to the real Supabase row
  // id, since removeCity(id) is called with the slug but DELETE needs the uuid
  const dbIdMap = useRef(new Map<string, string>())
  const hasMigrated = useRef(false)

  const fetchFavorites = async () => {
    const { data } = await api.get<FavoriteCity[]>('/api/cities/favorites')
    dbIdMap.current = new Map(data.map((row) => [toCityId(row.city_name, row.country), row.id]))
    setCities(data.map(toCity))
  }

  useEffect(() => {
    if (!isAuthenticated) {
      hasMigrated.current = false
      setCities(loadLocalCities())
      return
    }

    const migrateThenLoad = async () => {
      if (!hasMigrated.current) {
        hasMigrated.current = true
        const localCities = loadLocalCities()

        for (const city of localCities) {
          try {
            await api.post('/api/cities/favorites', {
              city_name: city.name,
              country: city.country,
              lat: city.lat,
              lon: city.lon,
            })
          } catch {
            // already a favorite (409) or a transient failure — either way,
            // skip it rather than block the rest of the migration
          }
        }

        if (localCities.length > 0) {
          localStorage.removeItem(STORAGE_KEY)
        }
      }

      await fetchFavorites()
    }

    migrateThenLoad()
  }, [isAuthenticated])

  const addCity = async (city: City): Promise<boolean> => {
    if (!isAuthenticated) {
      if (cities.some((existing) => existing.id === city.id)) return false
      const next = [...cities, city]
      setCities(next)
      saveLocalCities(next)
      return true
    }

    try {
      const { data } = await api.post<FavoriteCity>('/api/cities/favorites', {
        city_name: city.name,
        country: city.country,
        lat: city.lat,
        lon: city.lon,
      })
      dbIdMap.current.set(toCityId(data.city_name, data.country), data.id)
      setCities((prev) => [...prev, toCity(data)])
      return true
    } catch {
      return false
    }
  }

  const removeCity = async (id: string) => {
    if (!isAuthenticated) {
      const next = cities.filter((city) => city.id !== id)
      setCities(next)
      saveLocalCities(next)
      return
    }

    const dbId = dbIdMap.current.get(id)
    if (!dbId) return

    try {
      await api.delete(`/api/cities/favorites/${dbId}`)
      dbIdMap.current.delete(id)
      setCities((prev) => prev.filter((city) => city.id !== id))
    } catch {
      // leave the city in place — better than silently losing it on a transient error
    }
  }

  return { cities, addCity, removeCity }
}
