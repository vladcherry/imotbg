# imoti

**Live site: https://vladcherry.github.io/imotbg/**

A map of property sales in Sofia, Plovdiv, Varna and Burgas, built on imot.bg data.
A static site on GitHub Pages, with no backend.

## How it works

```
GitHub Actions (cron, twice daily)
  └─ npm run scrape → crawl imot.bg → normalise → geocode by neighbourhood
     └─ commit public/data/*.json
GitHub Pages
  └─ the SPA loads the JSON and filters/sorts everything client-side
```

imot.bg has no public API, so the data comes from parsing HTML. Review their
`robots.txt` and terms of use before any public launch.

## Running locally

```bash
npm install
npm run mock   # demo data, so the interface comes alive immediately
npm run dev
```

## Wiring up real data

Search results live at a clean path per city: `imot.bg/obiavi/prodazhbi/grad-<city>`
(page 2+: `.../grad-<city>/p-2`). The path for each city is already set in
`scripts/config.json`; you only need to touch it if imot.bg changes its slugs or you
add a city — open imot.bg, search that city, and copy the `grad-...` segment from the
resulting URL.

Check that the parser still matches the markup:

```bash
npm run probe "https://www.imot.bg/obiavi/prodazhbi/grad-sofiya"
```

The script saves the HTML to `scripts/.cache/probe.html` and reports how many cards
it found and what it managed to parse. If the count is zero, open the dump, find a
listing block and fix `CARD_SELECTORS` / `FIELD` in `scripts/imotbg.mjs`. Everything
coupled to imot.bg markup lives in that one file.

Once probe returns something sensible:

```bash
npm run scrape
```

## Coordinates

imot.bg does not expose a listing's coordinates, only its neighbourhood. Each point
is placed at the neighbourhood centre from `scripts/districts.json` and scattered
deterministically within a radius of roughly 260 m so listings do not overlap.
Neighbourhood coordinates are approximate.

At the end of a run the scraper prints every neighbourhood missing from the
dictionary. To add one:

```bash
npm run geocode sofia "Гърмидол" "Требич"
```

## Deployment

1. Push the repository to GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. The first push to `main` builds and publishes the site.

`vite.config.ts` reads the base path from `PAGES_BASE`; the workflow fills it with
the repository name. For a `user.github.io` domain, set `PAGES_BASE=/`.

`scrape.yml` commits fresh data to `main`. A push made with the built-in
`GITHUB_TOKEN` does not trigger other workflows, so `deploy.yml` subscribes to
`workflow_run` from `scrape.yml` and rebuilds the site after a successful scrape.

## What's inside

| Path | What it does |
|---|---|
| `scripts/imotbg.mjs` | fetching (windows-1251) and parsing imot.bg — the only place holding selectors |
| `scripts/scrape.mjs` | crawling, dedupe, geocoding, writing JSON |
| `scripts/probe.mjs` | selector diagnostics against a live page |
| `scripts/mock.mjs` | demo data generator |
| `src/lib/scale.ts` | the €/m² colour scale shared by the map and the ribbon |
| `src/components/PriceRibbon.tsx` | price ribbon — the €/m² distribution; drag across it to filter |
| `src/components/MapView.tsx` | MapLibre, clusters, point colour = €/m² |

Tiles come from OpenFreeMap — no key, no signup.

## Roadmap

- **Localisation.** The interface is English-only for now; the strings are still
  inline in the components and need extracting before a second language lands.
- **Price history.** The scraper already records `ts` for the first sighting and
  writes `prevPrice` when a price changes. The next step is a separate
  `public/data/history/*.json` holding a time series of median €/m² per neighbourhood.
- **Live data.** A Cloudflare Workers proxy: the frontend stays on Pages while the
  Worker talks to imot.bg and returns JSON with the right CORS headers.
