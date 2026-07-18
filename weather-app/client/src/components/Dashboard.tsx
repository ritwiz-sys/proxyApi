import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.ts'
import { useFavoriteCities } from '../hooks/useFavoriteCities.ts'
import { useUnit } from '../hooks/useUnit.ts'
import SearchBar from './SearchBar.tsx'
import CityCard from './CityCard.tsx'
import ComparisonTable from './ComparisonTable.tsx'
import AuthModal from './AuthModal.tsx'
import UserMenu from './UserMenu.tsx'
import type { City } from '../types.ts'

const Dashboard = () => {
  const { user, isAuthenticated, login, signup, logout } = useAuth()
  const { cities, addCity, removeCity } = useFavoriteCities(isAuthenticated)
  const { unit, toggleUnit } = useUnit()

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const hasShownSyncNudge = useRef(false)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleAddCity = async (city: City) => {
    const added = await addCity(city)
    if (added && !isAuthenticated && !hasShownSyncNudge.current) {
      hasShownSyncNudge.current = true
      setToast('Login to save cities across devices')
    }
    return added
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="relative mb-8 text-center">
          <div className="absolute right-0 top-0 flex flex-wrap items-center justify-end gap-2">
            {isAuthenticated && user ? (
              <UserMenu username={user.username} onLogout={logout} />
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Log In / Sign Up
              </button>
            )}
            <button
              type="button"
              onClick={toggleUnit}
              title="Toggle temperature unit"
              className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 p-1 text-sm font-medium text-slate-300"
            >
              <span
                className={`rounded-full px-2.5 py-1 transition ${unit === 'C' ? 'bg-sky-500 text-white' : ''}`}
              >
                °C
              </span>
              <span
                className={`rounded-full px-2.5 py-1 transition ${unit === 'F' ? 'bg-sky-500 text-white' : ''}`}
              >
                °F
              </span>
            </button>
          </div>
          <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
            Weather Dashboard
          </h1>
          <p className="mt-2 text-slate-400">
            Track and compare weather across your favorite cities
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <SearchBar cities={cities} onAddCity={handleAddCity} />
        </div>

        {cities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center text-slate-400">
            <div className="mb-3 text-4xl" aria-hidden="true">
              🌤️
            </div>
            Search for a city above to get started
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((city) => (
                <CityCard key={city.id} city={city} onRemove={removeCity} unit={unit} />
              ))}
            </div>

            <ComparisonTable cities={cities} unit={unit} />
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLogin={login}
          onSignup={signup}
        />
      )}
    </div>
  )
}

export default Dashboard
