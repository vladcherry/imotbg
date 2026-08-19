const nf = new Intl.NumberFormat('en-US')

export const eur = (n: number) => '€' + nf.format(n)

export const eurCompact = (n: number) =>
  n >= 1_000_000 ? '€' + (n / 1_000_000).toFixed(2) + 'M' : '€' + Math.round(n / 1000) + 'k'

export const num = (n: number) => nf.format(n)

export const CITY_LABEL: Record<string, string> = {
  sofia: 'Sofia',
  plovdiv: 'Plovdiv',
  varna: 'Varna',
  burgas: 'Burgas',
}

export const CITY_CENTER: Record<string, [number, number]> = {
  sofia: [23.3219, 42.6977],
  plovdiv: [24.7453, 42.1354],
  varna: [27.9147, 43.2141],
  burgas: [27.4626, 42.5048],
}

export function daysAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const months = Math.floor(d / 30)
  return `${months}mo ago`
}

export function floorLabel(floor: number | null, floors: number | null) {
  if (!floor) return null
  return floors ? `floor ${floor}/${floors}` : `floor ${floor}`
}
