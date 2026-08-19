// Добавляет координаты кварталов в districts.json через Nominatim.
// Запуск: node scripts/geocode.mjs sofia "Витоша" "Драгалевци"
// Nominatim: не больше 1 запроса в секунду, обязательно с User-Agent.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const path = resolve(here, 'districts.json')
const districts = JSON.parse(readFileSync(path, 'utf8'))

const CITY_NAMES = { sofia: 'София', plovdiv: 'Пловдив', varna: 'Варна', burgas: 'Бургас' }
const [city, ...names] = process.argv.slice(2)

if (!city || !CITY_NAMES[city] || !names.length) {
  console.error('Использование: node scripts/geocode.mjs <sofia|plovdiv|varna|burgas> "Квартал" ...')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const name of names) {
  const q = `${name}, ${CITY_NAMES[city]}, България`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'bgimot-geocoder/0.1' } })
  const json = await res.json()
  if (!json.length) {
    console.warn(`✗ ${name} — не найдено`)
  } else {
    const { lat, lon } = json[0]
    districts[city][name] = [+Number(lat).toFixed(4), +Number(lon).toFixed(4)]
    console.log(`✓ ${name} → ${lat}, ${lon}`)
  }
  await sleep(1100)
}

writeFileSync(path, JSON.stringify(districts, null, 2) + '\n')
console.log('districts.json обновлён')
