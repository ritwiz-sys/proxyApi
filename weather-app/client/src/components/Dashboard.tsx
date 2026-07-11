import { useCities } from '../hooks/useCities.ts'
import { useUnit } from '../hooks/useUnit.ts'
import SearchBar from './SearchBar.tsx'
import CityCard from './CityCard.tsx'
import ComparisonTable from './ComparisonTable.tsx'

const Dashboard = () => {
  const { cities, addCity, removeCity } = useCities()
  const { unit, toggleUnit } = useUnit()

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="relative mb-8 text-center">
          <button
            type="button"
            onClick={toggleUnit}
            title="Toggle temperature unit"
            className="absolute right-0 top-0 flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 p-1 text-sm font-medium text-slate-300"
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
          <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
            Weather Dashboard
          </h1>
          <p className="mt-2 text-slate-400">
            Track and compare weather across your favorite cities
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <SearchBar cities={cities} onAddCity={addCity} />
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
    </div>
  )
}

export default Dashboard
