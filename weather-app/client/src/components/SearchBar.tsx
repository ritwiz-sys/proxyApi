import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axiosInstance.ts'
import { useDebounce } from '../hooks/useDebounce.ts'
import { toCityId } from '../utils/city.ts'
import type { City, CitySearchResult } from '../types.ts'

interface SearchBarProps {
  cities: City[]
  onAddCity: (city: City) => boolean | Promise<boolean>
}

const fetchCitySuggestions = async (query: string): Promise<CitySearchResult[]> => {
  const { data } = await api.get<CitySearchResult[]>(
    `/api/cities/search?q=${encodeURIComponent(query)}`
  )
  return data
}

const SearchBar = ({ cities, onAddCity }: SearchBarProps) => {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)
  const canSearch = debouncedQuery.trim().length >= 3

  const { data: suggestions, isFetching, isError } = useQuery({
    queryKey: ['cities', 'search', debouncedQuery],
    queryFn: () => fetchCitySuggestions(debouncedQuery),
    enabled: canSearch,
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }

  const handleSelect = async (result: CitySearchResult) => {
    const city: City = {
      id: toCityId(result.name, result.country),
      name: result.name,
      country: result.country,
      lat: result.lat,
      lon: result.lon,
      addedAt: Date.now(),
    }

    setQuery('')
    setIsOpen(false)

    const added = await onAddCity(city)
    if (!added) {
      setToast(`${city.name} is already added`)
    }
  }

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        >
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search for a city..."
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        {isFetching && canSearch && (
          <div
            className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400"
            aria-label="Loading suggestions"
          />
        )}
      </div>

      {isOpen && canSearch && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
          {isFetching && (
            <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
          )}
          {!isFetching && isError && (
            <div className="px-4 py-3 text-sm text-red-400">
              Couldn't load suggestions — try again
            </div>
          )}
          {!isFetching && !isError && suggestions?.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">No cities found</div>
          )}
          {!isFetching &&
            !isError &&
            suggestions?.map((result) => {
              const id = toCityId(result.name, result.country)
              const alreadyAdded = cities.some((city) => city.id === id)
              return (
                <button
                  key={`${id}-${result.lat}-${result.lon}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-slate-700"
                >
                  <span>
                    {result.name}
                    {result.state ? `, ${result.state}` : ''}, {result.country}
                  </span>
                  {alreadyAdded && (
                    <span className="text-xs text-slate-400">Already added</span>
                  )}
                </button>
              )
            })}
        </div>
      )}

      {toast && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg bg-slate-700 px-4 py-2 text-center text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

export default SearchBar
