// Проверка селекторов на живой странице.
// Запуск: node scripts/probe.mjs "https://www.imot.bg/pcgi/imot.cgi?act=3&slink=XXXX&f1=1"
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { fetchPage, parseSearchPage } from './imotbg.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const url = process.argv[2]
if (!url) {
  console.error('Укажи URL страницы результатов поиска imot.bg')
  process.exit(1)
}

const html = await fetchPage(url)
mkdirSync(resolve(here, '.cache'), { recursive: true })
const dump = resolve(here, '.cache/probe.html')
writeFileSync(dump, html)
console.log(`HTML сохранён: ${dump} (${(html.length / 1024).toFixed(0)} КБ)`)

const $ = cheerio.load(html)
console.log('\nКандидаты в карточки объявления:')
for (const sel of ['table.tblOffers', 'div.listing', 'div.item', 'table[class*="Offer"]', 'a[href*="act=5"]']) {
  console.log(`  ${sel.padEnd(28)} → ${$(sel).length}`)
}

const { listings, cardCount } = parseSearchPage(html, { city: 'probe' })
console.log(`\nНайдено карточек: ${cardCount}, разобрано: ${listings.length}`)
console.log('\nПервые 3 объекта:')
console.log(JSON.stringify(listings.slice(0, 3), null, 2))

if (!listings.length) {
  console.log('\nНичего не разобралось. Открой .cache/probe.html, найди блок объявления')
  console.log('и поправь CARD_SELECTORS / FIELD в scripts/imotbg.mjs.')
}
