import { useEffect, useRef, useState } from 'react'
import type { Listing } from '../types'
import { daysAgo, eur, floorLabel, num } from '../lib/format'

const PAGE = 60

function Card({
  listing: l,
  selected,
  onSelect,
}: {
  listing: Listing
  selected: boolean
  onSelect: () => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const dropped = l.prevPrice && l.prevPrice > l.price

  return (
    <li ref={ref}>
      <button
        onClick={onSelect}
        className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${
          selected ? 'border-ink bg-paper' : 'border-transparent hover:bg-paper/70'
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[17px] font-medium tracking-tight">{eur(l.price)}</span>
          <span className="font-mono text-[12px] text-muted">{num(l.ppsm)} €/m²</span>
        </div>

        <div className="mt-0.5 truncate text-[14px]">
          {l.type ?? 'Property'} · {l.district ?? '—'}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
          <span className="font-mono">{l.area} m²</span>
          {floorLabel(l.floor, l.floors) && <span>{floorLabel(l.floor, l.floors)}</span>}
          {l.build && <span>{l.build}</span>}
          {l.year && <span className="font-mono">{l.year}</span>}
          <span className="ml-auto">{daysAgo(l.ts)}</span>
        </div>

        {dropped && (
          <div className="mt-1.5 inline-block rounded bg-hot/10 px-1.5 py-0.5 font-mono text-[11px] text-hot">
            −{num(l.prevPrice! - l.price)} € since last check
          </div>
        )}
      </button>
    </li>
  )
}

interface Props {
  results: Listing[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  loading: boolean
}

export default function ResultsList({ results, selectedId, onSelect, loading }: Props) {
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [results])

  if (loading) {
    return <div className="px-4 py-8 text-sm text-muted">Loading listings…</div>
  }

  if (!results.length) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm font-medium">Nothing matches these filters</p>
        <p className="mt-1 text-sm text-muted">
          Widen the price range or clear the selection on the price ribbon.
        </p>
      </div>
    )
  }

  const selected = results.find((r) => r.id === selectedId)

  return (
    <div>
      <ul className="divide-y divide-line/60">
        {results.slice(0, limit).map((l) => (
          <Card
            key={l.id}
            listing={l}
            selected={l.id === selectedId}
            onSelect={() => onSelect(l.id === selectedId ? null : l.id)}
          />
        ))}
      </ul>

      {selected && (
        <div className="sticky bottom-0 border-t border-line bg-panel px-4 py-3">
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white hover:bg-accent/90"
          >
            Open on imot.bg
          </a>
        </div>
      )}

      {limit < results.length && (
        <button
          onClick={() => setLimit((v) => v + PAGE * 2)}
          className="w-full border-t border-line py-3 text-sm text-accent hover:bg-paper"
        >
          Show {Math.min(PAGE * 2, results.length - limit)} more
        </button>
      )}
    </div>
  )
}
