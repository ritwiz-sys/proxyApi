import type { TempUnit } from '../hooks/useUnit.ts'

// The server always fetches OpenWeatherMap with units=metric, so every raw
// temperature value flowing through the app is Celsius — conversion happens
// only at display time, never before comparisons/min-max logic.
export const celsiusTo = (celsius: number, unit: TempUnit): number =>
  unit === 'F' ? (celsius * 9) / 5 + 32 : celsius

export const formatTemp = (celsius: number | undefined, unit: TempUnit): string => {
  if (celsius === undefined) return '—'
  return `${Math.round(celsiusTo(celsius, unit))}°${unit}`
}
