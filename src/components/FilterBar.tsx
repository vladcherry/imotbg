import { useState } from 'react'
import type { Filters, Listing, SortKey } from '../types'
import { eurCompact, num } from '../lib/format'
import { districtStats } from '../lib/data'

const TYPE_ORDER = ['1-СТАЕН', '2-СТАЕН', '3-СТАЕН', '4-СТАЕН', 'МНОГОСТАЕН', 'МЕЗОНЕТ', 'КЪЩА']
const TYPE_LABEL: Record<string, string> = {
  '1-СТАЕН': 'Студия',
  '2-СТАЕН': '1 спальня',
  '3-СТАЕН': '2 спальни',
  '4-СТАЕН': '3 спальни',
  МНОГОСТАЕН: '4+ спальни',
  МЕЗОНЕТ: 'Мезонет',
  КЪЩА: 'Дом',
}

const SORTS: [SortKey, string][] = [
  ['new', 'Сначала новые'],
  ['ppsm', 'Дешевле за м²'],
  ['price', 'Дешевле'],
  ['price-desc', 'Дороже'],
  ['area-desc', 'Больше площадь'],
]

interface Props {
  filters: Filters
  setFilters: (f: Filters) => void
  listings: Listing[]
  bounds: { price: [number, number]; area: [number, number] }
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-line bg-panel text-ink hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  )
}

function RangeInput({
  label,
  bounds,
  value,
  step,
  format,
  onChange,
}: {
  label: string
  bounds: [number, number]
  value: [number, number] | null
  step: number
  format: (n: number) => string
  onChange: (v: [number, number] | null) => void
}) {
  const [min, max] = value ?? bounds
  const set = (i: 0 | 1, raw: string) => {
    const n = Number(raw)
    const next: [number, number] = i === 0 ? [n, max] : [min, n]
    onChange(next[0] <= bounds[0] && next[1] >= bounds[1] ? null : next)
  }
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className="font-mono text-[11px] text-ink">
          {format(min)} — {format(max)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={min}
          onChange={(e) => set(0, e.target.value)}
          className="h-1 w-full accent-accent"
          aria-label={`${label}: минимум`}
        />
        <input
          type="range"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={max}
          onChange={(e) => set(1, e.target.value)}
          className="h-1 w-full accent-accent"
          aria-label={`${label}: максимум`}
        />
      </div>
    </div>
  )
}

export default function FilterBar({ filters, setFilters, listings, bounds }: Props) {
  const [districtsOpen, setDistrictsOpen] = useState(false)
  const patch = (p: Partial<Filters>) => setFilters({ ...filters, ...p })
  const stats = districtStats(listings)
  const availableTypes = TYPE_ORDER.filter((t) => listings.some((l) => l.type === t))

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <div className="space-y-4">
      <input
        value={filters.query}
        onChange={(e) => patch({ query: e.target.value })}
        placeholder="Район или ключевое слово"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
      />

      {availableTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTypes.map((t) => (
            <Chip
              key={t}
              active={filters.types.includes(t)}
              onClick={() => patch({ types: toggle(filters.types, t) })}
            >
              {TYPE_LABEL[t] ?? t}
            </Chip>
          ))}
        </div>
      )}

      <RangeInput
        label="Цена"
        bounds={bounds.price}
        value={filters.price}
        step={5000}
        format={eurCompact}
        onChange={(v) => patch({ price: v })}
      />
      <RangeInput
        label="Площадь, м²"
        bounds={bounds.area}
        value={filters.area}
        step={5}
        format={(n) => `${n}`}
        onChange={(v) => patch({ area: v })}
      />

      <div>
        <button
          onClick={() => setDistrictsOpen((v) => !v)}
          className="flex w-full items-baseline justify-between text-left"
        >
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Районы</span>
          <span className="font-mono text-[11px] text-accent">
            {filters.districts.length ? `выбрано ${filters.districts.length}` : 'все'}{' '}
            {districtsOpen ? '▴' : '▾'}
          </span>
        </button>
        {districtsOpen && (
          <div className="mt-2 max-h-56 space-y-px overflow-y-auto rounded-lg border border-line bg-panel">
            {stats.map((d) => (
              <label
                key={d.name}
                className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] hover:bg-paper"
              >
                <input
                  type="checkbox"
                  checked={filters.districts.includes(d.name)}
                  onChange={() => patch({ districts: toggle(filters.districts, d.name) })}
                  className="accent-accent"
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="font-mono text-[11px] text-muted">{num(d.ppsm)}</span>
                <span className="w-8 text-right font-mono text-[11px] text-muted">{d.count}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <select
        value={filters.sort}
        onChange={(e) => patch({ sort: e.target.value as SortKey })}
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        aria-label="Сортировка"
      >
        {SORTS.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
