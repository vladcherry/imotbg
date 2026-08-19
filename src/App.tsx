import { useMemo, useState } from 'react'
import type { CityKey, Filters } from './types'
import { useBounds, useCityData, useResults } from './lib/data'
import { CITY_LABEL, num } from './lib/format'
import MapView from './components/MapView'
import FilterBar from './components/FilterBar'
import PriceRibbon from './components/PriceRibbon'
import ResultsList from './components/ResultsList'

const CITIES: CityKey[] = ['sofia', 'plovdiv', 'varna', 'burgas']

const initialFilters = (city: CityKey): Filters => ({
  city,
  price: null,
  area: null,
  ppsm: null,
  types: [],
  districts: [],
  query: '',
  sort: 'new',
})

export default function App() {
  const [filters, setFilters] = useState<Filters>(initialFilters('sofia'))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const { listings, meta, state } = useCityData(filters.city)
  const bounds = useBounds(listings)
  const results = useResults(listings, filters)

  const median = useMemo(() => {
    if (!results.length) return null
    const arr = results.map((r) => r.ppsm).sort((a, b) => a - b)
    return arr[Math.floor(arr.length / 2)]
  }, [results])

  const switchCity = (city: CityKey) => {
    setSelectedId(null)
    setFilters(initialFilters(city))
  }

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <header className="z-20 flex shrink-0 items-center gap-4 border-b border-line bg-panel px-4 py-2.5">
        <span className="font-display text-[15px] tracking-tight">
          imoti<span className="text-accent">.</span>
        </span>

        <nav className="flex gap-0.5" aria-label="City">
          {CITIES.map((c) => (
            <button
              key={c}
              onClick={() => switchCity(c)}
              className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                filters.city === c ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              {CITY_LABEL[c]}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-muted">
          {median && <span className="hidden sm:inline">median {num(median)} €/m²</span>}
          <span>
            {num(results.length)}
            {results.length !== listings.length && `/${num(listings.length)}`}
          </span>
        </div>
      </header>

      {meta?.demo && (
        <div className="shrink-0 bg-hot/10 px-4 py-1.5 text-center text-[12px] text-hot">
          Demo data. Set up <code className="font-mono">scripts/config.json</code> and run{' '}
          <code className="font-mono">npm run scrape</code> to pull real imot.bg listings.
        </div>
      )}

      <main className="relative flex min-h-0 flex-1">
        <aside
          className={`flex w-full shrink-0 flex-col border-r border-line bg-panel md:w-[400px] ${
            mobileView === 'map' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="shrink-0 space-y-4 border-b border-line px-4 py-4">
            {bounds && (
              <PriceRibbon
                listings={listings}
                bounds={bounds.ppsm}
                value={filters.ppsm}
                onChange={(v) => setFilters({ ...filters, ppsm: v })}
              />
            )}
            {bounds && (
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                listings={listings}
                bounds={bounds}
              />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ResultsList
              results={results}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={state === 'loading'}
            />
            {state === 'error' && (
              <div className="px-4 py-8">
                <p className="text-sm font-medium">Could not load data for this city</p>
                <p className="mt-1 text-sm text-muted">
                  <code className="font-mono">public/data/{filters.city}.json</code> is missing. Run{' '}
                  <code className="font-mono">npm run mock</code> or{' '}
                  <code className="font-mono">npm run scrape</code>.
                </p>
              </div>
            )}
          </div>
        </aside>

        <div className={`relative flex-1 ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          <MapView
            listings={results}
            city={filters.city}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <button
          onClick={() => setMobileView((v) => (v === 'list' ? 'map' : 'list'))}
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm text-paper shadow-lg md:hidden"
        >
          {mobileView === 'list' ? 'Map' : 'List'}
        </button>
      </main>
    </div>
  )
}
