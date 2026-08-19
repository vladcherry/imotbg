import { useEffect, useMemo, useState } from 'react'
import type { CityKey, Filters, Listing, Meta } from '../types'

const BASE = import.meta.env.BASE_URL

export function useCityData(city: CityKey) {
  const [listings, setListings] = useState<Listing[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    Promise.all([
      fetch(`${BASE}data/${city}.json`).then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      }),
      fetch(`${BASE}data/meta.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([rows, m]) => {
        if (cancelled) return
        setListings(rows)
        setMeta(m)
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [city])

  return { listings, meta, state }
}

const inRange = (v: number, r: [number, number] | null) => !r || (v >= r[0] && v <= r[1])

export function applyFilters(listings: Listing[], f: Filters) {
  const q = f.query.trim().toLowerCase()
  return listings.filter((l) => {
    if (!inRange(l.price, f.price)) return false
    if (!inRange(l.area, f.area)) return false
    if (!inRange(l.ppsm, f.ppsm)) return false
    if (f.types.length && (!l.type || !f.types.includes(l.type))) return false
    if (f.districts.length && (!l.district || !f.districts.includes(l.district))) return false
    if (q && !`${l.title} ${l.district ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
}

const SORTERS: Record<Filters['sort'], (a: Listing, b: Listing) => number> = {
  new: (a, b) => b.ts - a.ts,
  price: (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  ppsm: (a, b) => a.ppsm - b.ppsm,
  'area-desc': (a, b) => b.area - a.area,
}

export function useResults(listings: Listing[], filters: Filters) {
  return useMemo(() => {
    const filtered = applyFilters(listings, filters)
    return filtered.sort(SORTERS[filters.sort])
  }, [listings, filters])
}

/** Bounds come from the whole dataset, not the filtered subset, or the sliders jump on every change. */
export function useBounds(listings: Listing[]) {
  return useMemo(() => {
    if (!listings.length) return null
    const ppsm = listings.map((l) => l.ppsm).sort((a, b) => a - b)
    const price = listings.map((l) => l.price).sort((a, b) => a - b)
    const area = listings.map((l) => l.area).sort((a, b) => a - b)
    const q = (arr: number[], p: number) => arr[Math.floor((arr.length - 1) * p)]
    return {
      ppsm: [q(ppsm, 0.01), q(ppsm, 0.99)] as [number, number],
      price: [q(price, 0.01), q(price, 0.99)] as [number, number],
      area: [q(area, 0.01), q(area, 0.99)] as [number, number],
      medianPpsm: q(ppsm, 0.5),
    }
  }, [listings])
}

export function districtStats(listings: Listing[]) {
  const map = new Map<string, { count: number; sum: number }>()
  for (const l of listings) {
    if (!l.district) continue
    const cur = map.get(l.district) ?? { count: 0, sum: 0 }
    cur.count++
    cur.sum += l.ppsm
    map.set(l.district, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, ppsm: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.count - a.count)
}
