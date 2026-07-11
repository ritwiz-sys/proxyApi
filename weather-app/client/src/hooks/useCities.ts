import { useEffect, useState } from 'react'
import type { City } from '../types.ts'

const STORAGE_KEY = 'dashboard_cities'

const loadCities = (): City[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as City[]) : []
  } catch {
    return []
  }
}

export function useCities() {
  const [cities, setCities] = useState<City[]>(() => loadCities())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cities))
  }, [cities])

  const addCity = (city: City): boolean => {
    if (cities.some((existing) => existing.id === city.id)) {
      return false
    }
    setCities((prev) => [...prev, city])
    return true
  }

  const removeCity = (id: string) => {
    setCities((prev) => prev.filter((city) => city.id !== id))
  }

  return { cities, addCity, removeCity }
}
