const nf = new Intl.NumberFormat('ru-RU')

export const eur = (n: number) => '€' + nf.format(n)

export const eurCompact = (n: number) =>
  n >= 1_000_000 ? '€' + (n / 1_000_000).toFixed(2) + ' млн' : '€' + Math.round(n / 1000) + 'к'

export const num = (n: number) => nf.format(n)

export const CITY_LABEL: Record<string, string> = {
  sofia: 'София',
  plovdiv: 'Пловдив',
  varna: 'Варна',
  burgas: 'Бургас',
}

export const CITY_CENTER: Record<string, [number, number]> = {
  sofia: [23.3219, 42.6977],
  plovdiv: [24.7453, 42.1354],
  varna: [27.9147, 43.2141],
  burgas: [27.4626, 42.5048],
}

export function daysAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d <= 0) return 'сегодня'
  if (d === 1) return 'вчера'
  if (d < 30) return `${d} дн. назад`
  return `${Math.floor(d / 30)} мес. назад`
}

export function floorLabel(floor: number | null, floors: number | null) {
  if (!floor) return null
  return floors ? `${floor}/${floors} эт.` : `${floor} эт.`
}
