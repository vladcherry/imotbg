export type CityKey = 'sofia' | 'plovdiv' | 'varna' | 'burgas'

export interface Listing {
  id: string
  url: string
  city: CityKey
  district: string | null
  type: string | null
  title: string
  price: number
  area: number
  ppsm: number
  floor: number | null
  floors: number | null
  build: string | null
  year: number | null
  photo: string | null
  lat: number
  lng: number
  ts: number
  prevPrice?: number
}

export interface Meta {
  updatedAt: string
  demo?: boolean
  cities: Record<string, { count: number; label: string }>
}

export type SortKey = 'new' | 'price' | 'price-desc' | 'ppsm' | 'area-desc'

export interface Filters {
  city: CityKey
  price: [number, number] | null
  area: [number, number] | null
  ppsm: [number, number] | null
  types: string[]
  districts: string[]
  query: string
  sort: SortKey
}
