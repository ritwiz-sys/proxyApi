import { useEffect, useState } from 'react'

export type TempUnit = 'C' | 'F'

const STORAGE_KEY = 'dashboard_unit'

const loadUnit = (): TempUnit => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'F' ? 'F' : 'C'
  } catch {
    return 'C'
  }
}

export function useUnit() {
  const [unit, setUnit] = useState<TempUnit>(() => loadUnit())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, unit)
  }, [unit])

  const toggleUnit = () => setUnit((prev) => (prev === 'C' ? 'F' : 'C'))

  return { unit, setUnit, toggleUnit }
}
