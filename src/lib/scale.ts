// Price-per-square-metre colour scale, shared by the map and the price ribbon.
// Single source of truth so the ribbon works as the map's legend.
export const PPSM_SCALE: [number, string][] = [
  [700, '#0D6E5F'],
  [1200, '#5AA08A'],
  [1800, '#D9C98B'],
  [2600, '#D98A4A'],
  [3500, '#C0451F'],
]

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const channel = (shift: number) =>
    Math.round((((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

/** Mirrors MapLibre's ['interpolate', ['linear'], ...] over PPSM_SCALE. */
export function colorForPpsm(ppsm: number): string {
  const first = PPSM_SCALE[0]
  const last = PPSM_SCALE[PPSM_SCALE.length - 1]
  if (ppsm <= first[0]) return first[1]
  if (ppsm >= last[0]) return last[1]
  for (let i = 1; i < PPSM_SCALE.length; i++) {
    const [v1, c1] = PPSM_SCALE[i - 1]
    const [v2, c2] = PPSM_SCALE[i]
    if (ppsm <= v2) return mix(c1, c2, (ppsm - v1) / (v2 - v1))
  }
  return first[1]
}
