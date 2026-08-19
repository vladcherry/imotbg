# imotbg — project specification

A handoff document. It captures every decision already made, so the project can be
rebuilt from scratch without re-litigating the design.

---

## Prompt to open a new chat with

> Build this project from the specification below. The stack and the architectural
> decisions are already settled — don't propose alternatives, just implement them.
> Verify that `tsc` and `vite build` both pass, initialise git with a meaningful
> commit history, and hand the result back as an archive.
>
> *(then paste this entire file)*

---

## What we're building

A web app for searching Bulgarian real estate on imot.bg data, with a modern,
map-first interface. Hosted on GitHub Pages; repository
`github.com/vladcherry/imotbg`, site at `vladcherry.github.io/imotbg/`.

**Scope of v1:**

| Parameter | Value |
|---|---|
| Cities | Sofia, Plovdiv, Varna, Burgas |
| Deal type | sales only |
| Priorities | 1) static MVP 2) map with clusters 3) price history 4) live data |

---

## The core constraint, and how we work around it

**imot.bg has no public API.** Everything sold as an "imot.bg API" (Apify,
parse.bot) is a wrapper around HTML scraping. We scrape it ourselves.

**GitHub Pages is static-only.** The browser can't `fetch` imot.bg directly:
CORS, plus Cloudflare sits in front of the site.

**Solution — GitHub Actions as the backend:**

```
GitHub Actions (cron, twice daily)
  └─ npm run scrape → crawl imot.bg → normalise → geocode
     └─ commit public/data/*.json to main
        └─ the push triggers a Pages rebuild
GitHub Pages
  └─ SPA loads the static JSON, filters and sorts client-side
```

Free, no CORS, served from a CDN. The one downside is data staleness equal to the
cron interval. Live data (priority 4) comes later via a Cloudflare Workers proxy,
with the frontend staying on Pages.

---

## Stack

- Vite + React 18 + TypeScript, `strict: true`
- Tailwind CSS 3
- MapLibre GL 4 for the map
- Tiles: OpenFreeMap `https://tiles.openfreemap.org/styles/positron` — no key, no signup
- Scraper: Node 20 ESM, `cheerio` + `iconv-lite`
- No backend, no external API keys

---

## Gotchas (already handled — don't lose these in a rebuild)

1. **windows-1251.** imot.bg serves Cyrillic as cp1251. Without an explicit
   `iconv-lite` decode you get mojibake. The charset is read from the first 2 KB
   of the response.
2. **No coordinates.** A listing carries only a city and a neighbourhood. We keep
   our own `neighbourhood → [lat, lng]` dictionary in `scripts/districts.json`.
   Geocoding each listing on the fly is not an option — Nominatim will ban you.
3. **Overlapping pins.** Every listing in a neighbourhood lands on the same point.
   The scatter is deterministic (FNV hash of the listing id), radius ~260 m, so
   points don't jump between runs.
4. **Duplicates.** The same flat is listed by several agencies. Collapse on the key
   `city|district|type|area|price|floor`; on a tie, keep the one that has a photo.
5. **`slink`.** imot.bg stores search parameters in a session identifier in the URL:
   `act=3&slink=XXXX&f1=N`. It's copied manually from the browser and expires after
   a while. It lives in `scripts/config.json`.
6. **Selectors.** imot.bg markup can change. Everything coupled to it lives in
   `scripts/imotbg.mjs` and nowhere else, with `probe.mjs` for diagnostics.
7. **Currency.** Prices appear in both EUR and BGN. Normalise to EUR at a fixed
   rate: `BGN_PER_EUR = 1.95583`.
8. **`robots.txt` / ToS.** Worth reviewing before any public launch.

---

## Design system

Direction: a quiet interface, with all the visual energy reserved for the map.
Deliberately **not** cream-and-serif, and **not** a dark theme with an acid accent.

**Palette** (Tailwind `theme.extend.colors`):

| Token | Hex | Role |
|---|---|---|
| `ink` | `#101614` | text, active states |
| `paper` | `#F1F2EE` | app background |
| `panel` | `#FFFFFF` | panels, cards |
| `line` | `#DCDCD4` | borders |
| `accent` | `#0D6E5F` | links, actions, focus |
| `hot` | `#C0451F` | price drops, warnings |
| `muted` | `#6B7370` | secondary text |

**Type** (Google Fonts, all with Cyrillic coverage):

- `display` — **Unbounded** 400/600, wordmark only, used with maximum restraint
- `sans` — **Onest** 400/500/600, the whole interface
- `mono` — **JetBrains Mono** 400/500/700, every number: prices, areas, €/m², years

Monospaced figures aren't decoration: price columns in the list line up and read
as a table.

**Signature element — the price ribbon.** A histogram of the €/m² distribution
across the city, sitting above the filters. Drag across it and both the list and
the map filter at once. The bars use the same colour scale as the map points, so
the ribbon doubles as a legend.

**The map as a price surface.** Point colour encodes price per square metre;
cluster colour encodes the cluster average. The map shows not "where the listings
are" but where it's expensive and where it's cheap. The scale:

```ts
export const PPSM_SCALE: [number, string][] = [
  [700,  '#0D6E5F'],
  [1200, '#5AA08A'],
  [1800, '#D9C98B'],
  [2600, '#D98A4A'],
  [3500, '#C0451F'],
]
```

**Quality floor:** responsive down to mobile (list/map toggle), visible keyboard
focus, `prefers-reduced-motion` respected.

---

## Data model

```ts
export type CityKey = 'sofia' | 'plovdiv' | 'varna' | 'burgas'

export interface Listing {
  id: string            // imot.bg listing id
  url: string
  city: CityKey
  district: string | null   // neighbourhood, Bulgarian name
  type: string | null       // '2-СТАЕН', 'КЪЩА', ...
  title: string
  price: number             // EUR
  area: number              // m²
  ppsm: number              // EUR/m², computed at scrape time
  floor: number | null
  floors: number | null
  build: string | null      // Тухла / Панел / ЕПК (brick / panel / EPK)
  year: number | null
  photo: string | null
  lat: number
  lng: number
  ts: number                // first-seen date — the basis for price history
  prevPrice?: number        // previous price, if it changed
}
```

Files: `public/data/{city}.json` holds an array of `Listing`, plus
`public/data/meta.json` with `updatedAt`, a `demo` flag, and per-city counts.

The scraper fills `ts` and `prevPrice` by diffing against the previous JSON.
This is the foundation for price history and must not be dropped.

---

## Repository layout

```
imotbg/
├─ .github/workflows/
│  ├─ scrape.yml          # cron '17 3,15 * * *' + workflow_dispatch
│  └─ deploy.yml          # push to main → build → Pages
├─ scripts/
│  ├─ imotbg.mjs          # THE ONLY place holding imot.bg selectors
│  ├─ scrape.mjs          # crawl, dedupe, geocode, write JSON
│  ├─ probe.mjs           # selector diagnostics against a live page
│  ├─ geocode.mjs         # top up neighbourhood coords via Nominatim
│  ├─ mock.mjs            # demo data generator
│  ├─ districts.json      # neighbourhood → [lat, lng] for 4 cities
│  └─ config.json         # slink and crawl parameters
├─ public/data/           # scraper output, committed to the repo
├─ src/
│  ├─ types.ts
│  ├─ lib/format.ts       # eur, num, CITY_LABEL, CITY_CENTER, daysAgo
│  ├─ lib/data.ts         # useCityData, useResults, useBounds, districtStats
│  ├─ components/
│  │  ├─ MapView.tsx      # MapLibre, clusters, colour by €/m²
│  │  ├─ PriceRibbon.tsx  # price ribbon with range brushing
│  │  ├─ FilterBar.tsx    # type, price, area, neighbourhoods, sort
│  │  └─ ResultsList.tsx  # cards with lazy loading
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ styles.css
├─ index.html
├─ vite.config.ts         # base: process.env.PAGES_BASE ?? '/imotbg/'
├─ tailwind.config.js
└─ README.md
```

---

## Key fragments

### Fetch with re-encoding

```js
const buf = Buffer.from(await res.arrayBuffer())
const head = buf.subarray(0, 2048).toString('latin1').toLowerCase()
const charset = /charset=["']?([\w-]+)/.exec(head)?.[1] ?? 'windows-1251'
const enc = /utf-?8/.test(charset) ? 'utf8' : 'win1251'
return iconv.decode(buf, enc)
```

### Selectors with fallbacks

```js
const CARD_SELECTORS = ['table.tblOffers', 'div.listing', 'div.item', 'table[class*="Offer"]']

const FIELD = {
  link:     ['a.lnk1', 'a.lnk2', 'a[href*="act=5"]', 'a[href*="/obiava"]'],
  price:    ['div.price', '.price', 'span.price'],
  location: ['a.lnk2', 'div.location', '.adress'],
  photo:    ['img[src*="/photosorg/"]', 'img[src*="imot.bg"]', 'img'],
}
```

Tried in order; the first non-empty match wins. When the markup changes, prepend
a new variant to the list.

### Deterministic point scatter

```js
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

const angle = hash(id) * Math.PI * 2
const dist  = Math.sqrt(hash(id + 'r')) * 260   // sqrt keeps it uniform over area
const dLat  = dist * Math.cos(angle) / 111320
const dLng  = dist * Math.sin(angle) / (111320 * Math.cos(baseLat * Math.PI / 180))
```

### MapLibre clusters carrying an average price

```ts
map.addSource('listings', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
  cluster: true,
  clusterRadius: 55,
  clusterMaxZoom: 15,
  clusterProperties: { ppsmSum: ['+', ['get', 'ppsm']] },
})
```

Cluster average: `['/', ['get', 'ppsmSum'], ['get', 'point_count']]`, then fed
through `['interpolate', ['linear'], ..., ...PPSM_SCALE.flat()]` to get a colour.

### Filter bounds from percentiles

Computed over the **entire** city dataset, not the filtered subset — otherwise the
sliders jump on every change. Use the 1st and 99th percentile so outliers don't
stretch the scale.

---

## Neighbourhood dictionary

`scripts/districts.json` is shaped like:

```json
{
  "sofia": {
    "_center": [42.6977, 23.3219],
    "Лозенец": [42.679, 23.323],
    "Младост 1": [42.652, 23.372]
  }
}
```

Coverage: Sofia ~85 neighbourhoods, Plovdiv ~20, Varna ~20, Burgas ~17. The
`_center` key is the fallback for an unknown neighbourhood. Coordinates are
approximate; refine them with `npm run geocode sofia "Neighbourhood"` (Nominatim,
max 1 request per second, User-Agent required).

At the end of a run the scraper prints every neighbourhood missing from the
dictionary.

---

## Deployment

`deploy.yml`: checkout → setup-node 20 → `npm ci` → if `public/data/sofia.json` is
absent, run `npm run mock` → `npm run build` with
`PAGES_BASE=/${{ github.event.repository.name }}/` → `upload-pages-artifact` →
`deploy-pages`.

Permissions: `contents: read`, `pages: write`, `id-token: write`.
In repo settings: **Settings → Pages → Source: GitHub Actions**.

`scrape.yml`: permissions `contents: write`; commits `public/data` as
`github-actions[bot]` and pushes to `main`, which triggers a rebuild. It only
commits when something actually changed (`git diff --staged --quiet`).

---

## Build order

1. Vite + React + Tailwind scaffold, configs, fonts in `index.html`
2. `scripts/imotbg.mjs` + `probe.mjs` — the parser and its diagnostics
3. `scripts/districts.json`, `geocode.mjs`, `scrape.mjs`
4. `scripts/mock.mjs` — without it there's nothing to fill the UI with before the
   scraper is configured
5. `types.ts`, `lib/format.ts`, `lib/data.ts`
6. `MapView.tsx`
7. `PriceRibbon.tsx`, `FilterBar.tsx`, `ResultsList.tsx`, `App.tsx`
8. Workflows and README

Verification: `npm run mock && npm run build` must pass cleanly, and `npm run dev`
must show a working interface on demo data.

---

## Not done yet — next steps

- **Price history.** `ts` and `prevPrice` are already written. What's missing is a
  separate `public/data/history/{city}.json` with a time series of median €/m² per
  neighbourhood, plus a chart in the neighbourhood card.
- **Live data.** A Cloudflare Worker proxying imot.bg with CORS headers, frontend
  staying on Pages. Free tier covers 100k requests/day.
- **Rentals.** Added as a second `searches` set in `config.json` plus a toggle in
  the UI.
- **List virtualisation.** Currently a simple 60-cards-at-a-time load. At tens of
  thousands of listings this needs `react-window`.
