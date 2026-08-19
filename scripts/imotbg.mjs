// Everything coupled to imot.bg markup lives here.
// If the site changes its HTML, this is the only file to touch.
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export const BGN_PER_EUR = 1.95583

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Fetches a page and re-encodes windows-1251 -> utf-8. */
export async function fetchPage(url, { retries = 3, delayMs = 1200 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'bg,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const head = buf.subarray(0, 2048).toString('latin1').toLowerCase()
      const charset = /charset=["']?([\w-]+)/.exec(head)?.[1] ?? 'windows-1251'
      const enc = /utf-?8/.test(charset) ? 'utf8' : 'win1251'
      await sleep(delayMs)
      return iconv.decode(buf, enc)
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(delayMs * attempt * 2)
    }
  }
}

/** "125 000 EUR" / "245 000 lv." -> price in EUR. */
export function parsePrice(raw) {
  if (!raw) return null
  const text = raw.replace(/\u00a0/g, ' ')
  const num = Number(text.replace(/[^\d]/g, ''))
  if (!num) return null
  const isBgn = /лв/i.test(text)
  return Math.round(isBgn ? num / BGN_PER_EUR : num)
}

/** "78 kv.m" -> 78 */
export function parseArea(raw) {
  if (!raw) return null
  const m = /(\d[\d\s]*(?:[.,]\d+)?)\s*(?:кв\.?\s*м|m2|м2)/i.exec(raw.replace(/\u00a0/g, ' '))
  if (!m) return null
  const n = Number(m[1].replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 5 && n < 5000 ? Math.round(n) : null
}

/** "3-ti ot 6" / "3-ти ет. от 6" -> { floor: 3, floors: 6 }; "Партер от 5" -> { floor: 0, floors: 5 } */
export function parseFloor(raw) {
  if (!raw) return { floor: null, floors: null }
  const ground = /партер\s*от\s*(\d{1,2})/i.exec(raw)
  if (ground) return { floor: 0, floors: Number(ground[1]) }
  const m = /(\d{1,2})-[а-я]{2,3}\.?(?:\s*ет\.?)?\s*от\s*(\d{1,2})/i.exec(raw)
  if (!m) return { floor: null, floors: null }
  return { floor: Number(m[1]), floors: Number(m[2]) }
}

/** "gr. Sofia, kv. Lozenets" -> "Lozenets" */
export function parseDistrict(raw) {
  if (!raw) return null
  const parts = raw.split(',').map((s) => s.trim())
  const last = parts[parts.length - 1] ?? ''
  return (
    last
      .replace(/^(кв\.|ж\.к\.|м-т|местност|район)\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim() || null
  )
}

const BUILD_TYPES = ['Тухла', 'Панел', 'ЕПК', 'ПК', 'Гредоред']

export function parseBuild(raw) {
  if (!raw) return null
  return BUILD_TYPES.find((t) => raw.includes(t)) ?? null
}

export function parseYear(raw) {
  const m = /\b(19[5-9]\d|20[0-4]\d)\b/.exec(raw ?? '')
  return m ? Number(m[1]) : null
}

/**
 * Parses a search results page.
 * imot.bg has used table.tblOffers/a.lnk1/div.price in the past and
 * div.item/a.title/<location> since its 2026 redesign. The candidate lists
 * below are tried in order; when the markup changes, prepend a new variant
 * to CARD_SELECTORS / FIELD.
 */
const CARD_SELECTORS = ['div.item', 'table.tblOffers', 'div.listing', 'table[class*="Offer"]']

const FIELD = {
  link: ['a.title', 'a.lnk1', 'a.lnk2', 'a[href*="act=5"]', 'a[href*="/obiava"]'],
  price: ['div.price', '.price', 'span.price'],
  location: ['a.title location', 'location', 'a.lnk2', 'div.location', '.adress'],
  photo: ['img.pic', 'img[src*="/photosorg/"]', 'img[src*="imot.bg"]', 'img'],
}

const pick = (root, $, list) => {
  for (const sel of list) {
    const el = root.find(sel).first()
    if (el.length) return el
  }
  return $()
}

export function parseSearchPage(html, { city }) {
  const $ = cheerio.load(html)
  let cards = $()
  for (const sel of CARD_SELECTORS) {
    cards = $(sel)
    if (cards.length > 1) break
  }

  const out = []
  cards.each((_, el) => {
    const root = $(el)
    const link = pick(root, $, FIELD.link)
    let href = link.attr('href')
    if (!href) return
    if (href.startsWith('//')) href = 'https:' + href
    if (href.startsWith('/')) href = 'https://www.imot.bg' + href

    const id =
      /\/obiava-([0-9a-z]+)-/i.exec(href)?.[1] ??
      /adv=(\d+)/.exec(href)?.[1] ??
      /(\d{8,})/.exec(href)?.[1]
    if (!id) return

    const titleEl = link.clone()
    titleEl.find('location').remove()
    const title = titleEl.text().replace(/\s+/g, ' ').trim()
    const priceText = pick(root, $, FIELD.price).text()
    const locText = pick(root, $, FIELD.location).text().replace(/\s+/g, ' ').trim()
    const body = root.text().replace(/\s+/g, ' ')
    let photo = pick(root, $, FIELD.photo).attr('src') ?? null
    if (photo?.startsWith('//')) photo = 'https:' + photo

    const price = parsePrice(priceText)
    const area = parseArea(body)

    out.push({
      id,
      url: href.split('&').slice(0, 2).join('&'),
      city,
      district: parseDistrict(locText),
      type: /(\d-СТАЕН|МНОГОСТАЕН|МЕЗОНЕТ|АТЕЛИЕ|КЪЩА|ВИЛА|ЕТАЖ ОТ КЪЩА|ПАРЦЕЛ|ОФИС|МАГАЗИН)/i
        .exec(title)?.[1]
        ?.toUpperCase() ?? null,
      title,
      price,
      area,
      ppsm: price && area ? Math.round(price / area) : null,
      ...parseFloor(body),
      build: parseBuild(body),
      year: parseYear(body),
      photo,
    })
  })

  const hasNext = /следваща|напред|next|»/i.test($('body').text()) && cards.length > 0
  return { listings: out, hasNext, cardCount: cards.length }
}
