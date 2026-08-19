import { useEffect, useRef } from 'react'
import maplibregl, { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { CityKey, Listing } from '../types'
import { CITY_CENTER } from '../lib/format'
import { PPSM_SCALE } from '../lib/scale'

const colorExpr = (input: unknown) => [
  'interpolate',
  ['linear'],
  input,
  ...PPSM_SCALE.flat(),
]

const STYLE = 'https://tiles.openfreemap.org/styles/positron'

interface Props {
  listings: Listing[]
  city: CityKey
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export default function MapView({ listings, city, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const ready = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // listing id -> numeric feature id, rebuilt on every data push
  const featureIds = useRef(new Map<string, number>())
  const highlighted = useRef<number | null>(null)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  /** Moves the `selected` feature state to the currently selected listing. */
  const applyHighlight = () => {
    const m = map.current
    if (!m || !ready.current || !m.getSource('listings')) return
    if (highlighted.current !== null) {
      m.setFeatureState({ source: 'listings', id: highlighted.current }, { selected: false })
      highlighted.current = null
    }
    const id = selectedIdRef.current
    if (!id) return
    const fid = featureIds.current.get(id)
    if (fid === undefined) return
    m.setFeatureState({ source: 'listings', id: fid }, { selected: true })
    highlighted.current = fid
  }

  useEffect(() => {
    if (!container.current || map.current) return
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: CITY_CENTER[city],
      zoom: 11,
      attributionControl: { compact: true },
    })
    map.current = m
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    m.on('load', () => {
      m.addSource('listings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 15,
        clusterProperties: { ppsmSum: ['+', ['get', 'ppsm']] },
      })

      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'listings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': colorExpr(['/', ['get', 'ppsmSum'], ['get', 'point_count']]) as never,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            2, 16,
            25, 24,
            150, 34,
            600, 46,
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      })

      m.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'listings',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#FFFFFF' },
      })

      m.addLayer({
        id: 'points',
        type: 'circle',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': colorExpr(['get', 'ppsm']) as never,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 11],
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1.5],
          'circle-stroke-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#101614',
            '#FFFFFF',
          ],
        },
      })

      m.addLayer({
        id: 'point-labels',
        type: 'symbol',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        minzoom: 14.5,
        layout: {
          'text-field': ['concat', ['to-string', ['round', ['/', ['get', 'ppsm'], 10]]], '0'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#101614',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.4,
        },
      })

      m.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) onSelectRef.current(String(id))
      })
      m.on('click', 'clusters', async (e) => {
        const f = e.features?.[0]
        if (!f) return
        const src = m.getSource('listings') as GeoJSONSource
        const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id as number)
        m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom })
      })
      for (const layer of ['points', 'clusters']) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''))
      }

      ready.current = true
      m.fire('data-ready')
    })

    return () => {
      m.remove()
      map.current = null
      ready.current = false
    }
  }, [])

  // Data
  useEffect(() => {
    const m = map.current
    if (!m) return
    const push = () => {
      const src = m.getSource('listings') as GeoJSONSource | undefined
      if (!src) return
      // Feature ids are positional, so they change on every push.
      // Drop the old feature state before reassigning them.
      m.removeFeatureState({ source: 'listings' })
      highlighted.current = null
      const ids = new Map<string, number>()
      const features = listings.map((l, i) => {
        ids.set(l.id, i + 1)
        return {
          type: 'Feature' as const,
          id: i + 1,
          geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
          properties: { id: l.id, ppsm: l.ppsm, price: l.price },
        }
      })
      featureIds.current = ids
      src.setData({ type: 'FeatureCollection', features })
      applyHighlight()
    }
    if (ready.current) {
      push()
      return
    }
    // Data can arrive before the style loads; drop the pending listener on rerun.
    m.once('data-ready', push)
    return () => {
      m.off('data-ready', push)
    }
  }, [listings])

  // City switch
  useEffect(() => {
    map.current?.easeTo({ center: CITY_CENTER[city], zoom: 11, duration: 700 })
  }, [city])

  // Selected listing: paint the feature state and fly to it
  useEffect(() => {
    applyHighlight()
    const m = map.current
    if (!m || !selectedId) return
    const l = listings.find((x) => x.id === selectedId)
    if (!l) return
    m.easeTo({ center: [l.lng, l.lat], zoom: Math.max(m.getZoom(), 15), duration: 600 })
  }, [selectedId, listings])

  return <div ref={container} className="absolute inset-0" />
}
