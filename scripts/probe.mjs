// Checks the selectors against a live page.
// Usage: node scripts/probe.mjs "https://www.imot.bg/pcgi/imot.cgi?act=3&slink=XXXX&f1=1"
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { fetchPage, parseSearchPage } from './imotbg.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const url = process.argv[2]
if (!url) {
  console.error('Pass the URL of an imot.bg search results page')
  process.exit(1)
}

const html = await fetchPage(url)
mkdirSync(resolve(here, '.cache'), { recursive: true })
const dump = resolve(here, '.cache/probe.html')
writeFileSync(dump, html)
console.log(`HTML saved: ${dump} (${(html.length / 1024).toFixed(0)} KB)`)

const $ = cheerio.load(html)
console.log('\nListing card candidates:')
for (const sel of ['table.tblOffers', 'div.listing', 'div.item', 'table[class*="Offer"]', 'a[href*="act=5"]']) {
  console.log(`  ${sel.padEnd(28)} → ${$(sel).length}`)
}

const { listings, cardCount } = parseSearchPage(html, { city: 'probe' })
console.log(`\nCards found: ${cardCount}, parsed: ${listings.length}`)
console.log('\nFirst 3 listings:')
console.log(JSON.stringify(listings.slice(0, 3), null, 2))

if (!listings.length) {
  console.log('\nNothing parsed. Open .cache/probe.html, find the listing block')
  console.log('and adjust CARD_SELECTORS / FIELD in scripts/imotbg.mjs.')
}
