import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPage, parseSearchPage } from './imotbg.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(here, 'config.json'), 'utf8'))
const districts = JSON.parse(readFileSync(resolve(here, 'districts.json'), 'utf8'))
const dataDir = resolve(here, '../public/data')

const pageUrl = (slink, page) =>
  `https://www.imot.bg/pcgi/imot.cgi?act=3&slink=${slink}&f1=${page}`

/** Deterministic hash so a listing keeps the same scatter between runs. */
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/**
 * imot.bg exposes no coordinates, only a neighbourhood.
 * Place the point at the neighbourhood centre and scatter it inside a
 * circle so listings do not collapse onto a single pixel.
 */
function locate(listing) {
  const dict = districts[listing.city]
  if (!dict) return null
  const base = (listing.district && dict[listing.district]) || dict._center
  if (!base) return null

  const angle = hash(listing.id) * Math.PI * 2
  const dist = Math.sqrt(hash(listing.id + 'r')) * config.jitterMeters
  const dLat = (dist * Math.cos(angle)) / 111320
  const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos((base[0] * Math.PI) / 180))

  return {
    lat: +(base[0] + dLat).toFixed(6),
    lng: +(base[1] + dLng).toFixed(6),
    exactDistrict: Boolean(listing.district && dict[listing.district]),
  }
}

/** The same property is listed by several agencies; collapse duplicates. */
function dedupe(listings) {
  const seen = new Map()
  for (const l of listings) {
    const key = [l.city, l.district, l.type, l.area, l.price, l.floor].join('|')
    const prev = seen.get(key)
    if (!prev || (!prev.photo && l.photo)) seen.set(key, l)
  }
  return [...seen.values()]
}

async function scrapeCity({ city, slink, label }) {
  if (!slink || slink === 'REPLACE_ME') {
    console.warn(`[${city}] slink is not set in config.json, skipping`)
    return []
  }
  const all = []
  for (let page = 1; page <= config.maxPagesPerCity; page++) {
    let html
    try {
      html = await fetchPage(pageUrl(slink, page), { delayMs: config.delayMs })
    } catch (err) {
      console.error(`[${city}] page ${page}: ${err.message}`)
      break
    }
    const { listings, cardCount } = parseSearchPage(html, { city })
    console.log(`[${city}] page ${page}: ${cardCount} cards, ${listings.length} parsed`)
    if (!listings.length) break
    all.push(...listings)
  }
  console.log(`[${city}] ${label}: ${all.length} collected`)
  return all
}

async function main() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  const now = Date.now()
  const meta = { updatedAt: new Date().toISOString(), cities: {} }
  const unknownDistricts = new Set()

  for (const search of config.searches) {
    const raw = await scrapeCity(search)
    const prepared = dedupe(raw)
      .map((l) => {
        const geo = locate(l)
        if (!geo) return null
        if (!geo.exactDistrict && l.district) unknownDistricts.add(`${l.city}: ${l.district}`)
        return { ...l, ...geo, ts: now }
      })
      .filter((l) => l && l.price && l.area)

    // Keep the first-seen date so price history can be built later.
    const file = resolve(dataDir, `${search.city}.json`)
    if (existsSync(file)) {
      const prevById = new Map(JSON.parse(readFileSync(file, 'utf8')).map((l) => [l.id, l]))
      for (const l of prepared) {
        const prev = prevById.get(l.id)
        if (prev) {
          l.ts = prev.ts
          if (prev.price !== l.price) l.prevPrice = prev.price
        }
      }
    }

    writeFileSync(file, JSON.stringify(prepared))
    meta.cities[search.city] = { count: prepared.length, label: search.label }
    console.log(`[${search.city}] wrote ${prepared.length} listings`)
  }

  writeFileSync(resolve(dataDir, 'meta.json'), JSON.stringify(meta, null, 2))

  if (unknownDistricts.size) {
    console.warn('\nNeighbourhoods without coordinates (fell back to the city centre):')
    for (const d of [...unknownDistricts].sort()) console.warn('  ' + d)
    console.warn('Add them to scripts/districts.json or run npm run geocode')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
