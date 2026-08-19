// Демо-данные, чтобы интерфейс работал до того, как заработает скрапер.
// Запуск: npm run mock
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const districts = JSON.parse(readFileSync(resolve(here, 'districts.json'), 'utf8'))
const dataDir = resolve(here, '../public/data')
mkdirSync(dataDir, { recursive: true })

// Базовая цена €/м² по городу — примерный порядок величин, не рыночные данные.
const BASE_PPSM = { sofia: 2100, plovdiv: 1450, varna: 1600, burgas: 1350 }
const COUNT = { sofia: 1400, plovdiv: 500, varna: 600, burgas: 400 }
const TYPES = ['1-СТАЕН', '2-СТАЕН', '2-СТАЕН', '3-СТАЕН', '3-СТАЕН', '4-СТАЕН', 'МЕЗОНЕТ', 'КЪЩА']
const BUILDS = ['Тухла', 'Тухла', 'Панел', 'ЕПК']
const ROOM_AREA = { '1-СТАЕН': 45, '2-СТАЕН': 68, '3-СТАЕН': 95, '4-СТАЕН': 125, МЕЗОНЕТ: 140, КЪЩА: 190 }

let seed = 42
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

const meta = { updatedAt: new Date().toISOString(), demo: true, cities: {} }

for (const [city, count] of Object.entries(COUNT)) {
  const names = Object.keys(districts[city]).filter((k) => k !== '_center')
  const center = districts[city]._center
  const out = []

  for (let i = 0; i < count; i++) {
    const district = pick(names)
    const [dLat, dLng] = districts[city][district]
    // Чем дальше от центра — тем дешевле, плюс шум.
    const distKm = Math.hypot((dLat - center[0]) * 111, (dLng - center[1]) * 82)
    const type = pick(TYPES)
    const area = Math.round(ROOM_AREA[type] * (0.75 + rnd() * 0.5))
    const ppsm = Math.round(BASE_PPSM[city] * Math.max(0.55, 1.25 - distKm * 0.045) * (0.85 + rnd() * 0.35))
    const price = Math.round((ppsm * area) / 500) * 500
    const floors = 2 + Math.floor(rnd() * 8)

    out.push({
      id: `mock-${city}-${i}`,
      url: 'https://www.imot.bg/',
      city,
      district,
      type,
      title: `${type}, ${district}`,
      price,
      area,
      ppsm: Math.round(price / area),
      floor: 1 + Math.floor(rnd() * floors),
      floors,
      build: pick(BUILDS),
      year: 1965 + Math.floor(rnd() * 60),
      photo: null,
      lat: +(dLat + (rnd() - 0.5) * 0.006).toFixed(6),
      lng: +(dLng + (rnd() - 0.5) * 0.008).toFixed(6),
      ts: Date.now() - Math.floor(rnd() * 60) * 86400000,
      ...(rnd() < 0.08 ? { prevPrice: Math.round((price * 1.07) / 500) * 500 } : {}),
    })
  }

  writeFileSync(resolve(dataDir, `${city}.json`), JSON.stringify(out))
  meta.cities[city] = { count: out.length, label: city }
  console.log(`${city}: ${out.length} демо-объектов`)
}

writeFileSync(resolve(dataDir, 'meta.json'), JSON.stringify(meta, null, 2))
console.log('Готово. Это демо-данные — цены выдуманы.')
