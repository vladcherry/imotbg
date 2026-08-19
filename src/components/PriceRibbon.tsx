import { useMemo, useRef, useState } from 'react'
import type { Listing } from '../types'
import { num } from '../lib/format'
import { colorForPpsm } from '../lib/scale'

const BINS = 48

interface Props {
  listings: Listing[]
  bounds: [number, number]
  value: [number, number] | null
  onChange: (v: [number, number] | null) => void
}

/**
 * Price ribbon: the distribution of listings by €/m².
 * Drag across it to filter both the list and the map in one gesture.
 */
export default function PriceRibbon({ listings, bounds, value, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ from: number } | null>(null)
  const [lo, hi] = bounds

  const bars = useMemo(() => {
    const counts = new Array(BINS).fill(0)
    for (const l of listings) {
      const idx = Math.floor(((l.ppsm - lo) / (hi - lo)) * BINS)
      if (idx >= 0 && idx < BINS) counts[idx]++
    }
    const max = Math.max(1, ...counts)
    return counts.map((c, i) => ({
      count: c,
      h: c / max,
      ppsm: Math.round(lo + ((i + 0.5) / BINS) * (hi - lo)),
    }))
  }, [listings, lo, hi])

  const toPpsm = (clientX: number) => {
    const rect = svg.current!.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round(lo + t * (hi - lo))
  }

  const pos = (ppsm: number) => ((ppsm - lo) / (hi - lo)) * 100

  const handleDown = (e: React.PointerEvent) => {
    const from = toPpsm(e.clientX)
    setDrag({ from })
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(null)
  }
  const handleMove = (e: React.PointerEvent) => {
    if (!drag) return
    const to = toPpsm(e.clientX)
    onChange([Math.min(drag.from, to), Math.max(drag.from, to)])
  }
  const handleUp = () => {
    if (drag && value && value[1] - value[0] < (hi - lo) * 0.02) onChange(null)
    setDrag(null)
  }

  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Price per m², €</span>
        {value ? (
          <button
            onClick={() => onChange(null)}
            className="font-mono text-[11px] text-accent hover:underline"
          >
            {num(value[0])}–{num(value[1])} ✕
          </button>
        ) : (
          <span className="font-mono text-[11px] text-muted">
            {num(lo)}–{num(hi)}
          </span>
        )}
      </div>

      <svg
        ref={svg}
        viewBox="0 0 100 22"
        preserveAspectRatio="none"
        className="h-12 w-full cursor-ew-resize touch-none"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        role="slider"
        aria-label="Price per square metre range"
        aria-valuemin={lo}
        aria-valuemax={hi}
        aria-valuenow={value ? value[0] : lo}
      >
        {bars.map((b, i) => {
          const active = !value || (b.ppsm >= value[0] && b.ppsm <= value[1])
          return (
            <rect
              key={i}
              x={(i / BINS) * 100}
              y={22 - Math.max(0.7, b.h * 22)}
              width={100 / BINS - 0.25}
              height={Math.max(0.7, b.h * 22)}
              fill={colorForPpsm(b.ppsm)}
              opacity={active ? 1 : 0.18}
            />
          )
        })}
        {value && (
          <>
            <line x1={pos(value[0])} y1="0" x2={pos(value[0])} y2="22" stroke="#101614" strokeWidth="0.35" />
            <line x1={pos(value[1])} y1="0" x2={pos(value[1])} y2="22" stroke="#101614" strokeWidth="0.35" />
          </>
        )}
      </svg>
    </div>
  )
}
