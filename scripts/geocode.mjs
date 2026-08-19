// Adds neighbourhood coordinates to districts.json via Nominatim.
// Usage: node scripts/geocode.mjs sofia "Витоша" "Драгалевци"
// Nominatim: max 1 request per second, User-Agent required.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const path = resolve(here, 'districts.json')
const districts = JSON.parse(readFileSync(path, 'utf8'))

const CITY_NAMES = { sofia: 'София', plovdiv: 'Пловдив', varna: 'Варна', burgas: 'Бургас' }
const [city, ...names] = process.argv.slice(2)

if (!city || !CITY_NAMES[city] || !names.length) {
  console.error('Usage: node scripts/geocode.mjs <sofia|plovdiv|varna|burgas> "Neighbourhood" ...')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const name of names) {
  const q = `${name}, ${CITY_NAMES[city]}, България`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'bgimot-geocoder/0.1' } })
  const json = await res.json()
  if (!json.length) {
    console.warn(`✗ ${name} — not found`)
  } else {
    const { lat, lon } = json[0]
    districts[city][name] = [+Number(lat).toFixed(4), +Number(lon).toFixed(4)]
    console.log(`✓ ${name} → ${lat}, ${lon}`)
  }
  await sleep(1100)
}

writeFileSync(path, JSON.stringify(districts, null, 2) + '\n')
console.log('districts.json updated')
