import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { BoxSel, LatLon, Layer2 } from '@/hooks/useExplorer2State'

maplibregl.setWorkerUrl(workerUrl)

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

// NASA imagery only for the scored view (GIBS, public domain). The 3D extrusion uses AWS
// Terrain Tiles, an optional non-NASA extra that never feeds a score.
const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sky: {
    'sky-color': '#05080d',
    'horizon-color': '#1b3554',
    'fog-color': '#0a1019',
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 6, 0.4, 9, 0],
  },
  sources: {
    bluemarble: {
      type: 'raster',
      tiles: [`${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`],
      tileSize: 256,
      maxzoom: 8,
      attribution: 'Blue Marble: NASA Earth Observatory / GIBS',
    },
    landsat: {
      type: 'raster',
      tiles: [`${GIBS}/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/1990-12-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg`],
      tileSize: 256,
      maxzoom: 12,
      bounds: [-180, -60, 180, 85], // WELD has no Antarctica; Blue Marble shows there
      attribution: 'Landsat WELD 1990 (NASA/USGS) via NASA GIBS',
    },
    relief: {
      type: 'raster',
      tiles: [`${GIBS}/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg`],
      tileSize: 256,
      maxzoom: 12,
      attribution: 'ASTER GDEM (NASA/METI) via NASA GIBS',
    },
    dem: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 12,
      encoding: 'terrarium',
      attribution: '3D extrusion: AWS Terrain Tiles (optional, not scored)',
    },
    candidates: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    selection: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#05080d' } },
    { id: 'bluemarble', type: 'raster', source: 'bluemarble', paint: { 'raster-saturation': -0.15, 'raster-brightness-max': 0.92 } },
    { id: 'landsat', type: 'raster', source: 'landsat', minzoom: 4, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 1] } },
    { id: 'relief', type: 'raster', source: 'relief', minzoom: 3, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9 } },
    {
      id: 'box-fill',
      type: 'fill',
      source: 'selection',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#7fd8e6', 'fill-opacity': 0.08 },
    },
    {
      id: 'box-line',
      type: 'line',
      source: 'selection',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': '#7fd8e6', 'line-width': 1.5, 'line-dasharray': [3, 2] },
    },
    {
      id: 'candidates',
      type: 'circle',
      source: 'candidates',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 6, 10, 9],
        'circle-color': ['case', ['get', 'novel'], '#e7a1c9', '#7fd8e6'],
        'circle-stroke-color': '#05080d',
        'circle-stroke-width': 1,
        'circle-opacity': ['interpolate', ['linear'], ['get', 'sai'], 50, 0.45, 90, 1],
      },
    },
    {
      id: 'selected',
      type: 'circle',
      source: 'selection',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#fff2fa', 'circle-stroke-width': 2.5 },
    },
  ],
}

export interface MapCandidate {
  lat: number
  lon: number
  sai: number
  novel: boolean
}

interface Props {
  candidates: MapCandidate[]
  selected: LatLon | null
  box: BoxSel | null
  drawing: boolean
  layer: Layer2
  onPick: (p: LatLon) => void
  onBox: (b: BoxSel) => void
  reducedMotion: boolean
  padding: { left: number; right: number; top: number; bottom: number }
}

const boxPolygon = (b: BoxSel) => ({
  type: 'Polygon' as const,
  coordinates: [[[b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north], [b.west, b.south]]],
})

const toBox = (a: LatLon, b: LatLon): BoxSel => ({
  south: Math.min(a.lat, b.lat),
  north: Math.max(a.lat, b.lat),
  west: Math.min(a.lon, b.lon),
  east: Math.max(a.lon, b.lon),
})

/** Globe of NASA imagery: click anywhere to score it, or draw a box with two clicks. */
export function MapView2({ candidates, selected, box, drawing, layer, onPick, onBox, reducedMotion, padding }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [loaded, setLoaded] = useState(false)
  const corner = useRef<LatLon | null>(null)
  const appliedLayer = useRef<Layer2 | null>(null)
  const props = useRef({ onPick, onBox, drawing })
  props.current = { onPick, onBox, drawing }

  useEffect(() => {
    if (!container.current) return
    const m = new maplibregl.Map({ container: container.current, style: STYLE, center: [60, 25], zoom: 1.8, attributionControl: { compact: true }, maxPitch: 70 })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('click', (e) => {
      const p = { lat: e.lngLat.lat, lon: e.lngLat.wrap().lng }
      if (props.current.drawing) {
        if (!corner.current) {
          corner.current = p
          ;(m.getSource('selection') as GeoJSONSource | undefined)?.setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }],
          })
        } else {
          props.current.onBox(toBox(corner.current, p))
          corner.current = null
        }
        return
      }
      const hit = m.queryRenderedFeatures(e.point, { layers: ['candidates'] })[0]
      const coords = hit?.geometry.type === 'Point' ? (hit.geometry.coordinates as [number, number]) : null
      props.current.onPick(coords ? { lat: coords[1], lon: coords[0] } : p)
    })
    m.on('mousemove', (e) => {
      if (!props.current.drawing || !corner.current) return
      ;(m.getSource('selection') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: boxPolygon(toBox(corner.current, { lat: e.lngLat.lat, lon: e.lngLat.wrap().lng })) }],
      })
    })
    m.on('mouseenter', 'candidates', () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', 'candidates', () => (m.getCanvas().style.cursor = ''))
    m.once('style.load', () => setLoaded(true))
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !loaded) return
    m.getCanvas().style.cursor = drawing ? 'crosshair' : ''
    if (!drawing) corner.current = null
  }, [drawing, loaded])

  useEffect(() => {
    if (!loaded) return
    ;(map.current?.getSource('candidates') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: candidates.map((c) => ({ type: 'Feature', properties: { sai: c.sai, novel: c.novel }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } })),
    })
  }, [candidates, loaded])

  useEffect(() => {
    const m = map.current
    if (!m || !loaded) return
    const features: { type: 'Feature'; properties: object; geometry: ReturnType<typeof boxPolygon> | { type: 'Point'; coordinates: number[] } }[] = []
    if (box) features.push({ type: 'Feature', properties: {}, geometry: boxPolygon(box) })
    if (selected) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [selected.lon, selected.lat] } })
    ;(m.getSource('selection') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })
    if (!selected) return
    const opts = { center: [selected.lon, selected.lat] as [number, number], zoom: Math.max(m.getZoom(), box ? 7 : 6), padding }
    if (reducedMotion) m.jumpTo(opts)
    else m.flyTo({ ...opts, duration: 1800, essential: true })
    // padding changes with panel layout; only move the camera when the selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.lat, selected?.lon, box, loaded])

  useEffect(() => {
    const m = map.current
    if (!m || !loaded) return
    const terrain = layer === 'terrain'
    m.setLayoutProperty('relief', 'visibility', terrain ? 'visible' : 'none')
    const set = () => m.setTerrain(terrain ? { source: 'dem', exaggeration: 1.4 } : null)
    if (m.isMoving()) m.once('moveend', set)
    else set()
    // tilt only when the user switches layers; easing at load would cancel the fly-to a deep-linked place
    if (appliedLayer.current !== null && appliedLayer.current !== layer) m.easeTo({ pitch: terrain ? 55 : 0, duration: reducedMotion ? 0 : 900 })
    appliedLayer.current = layer
  }, [layer, loaded, reducedMotion])

  return (
    <div className="absolute inset-0" role="region" aria-label="Globe: click a place to score it" aria-busy={!loaded}>
      <div ref={container} className={`h-full w-full transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="label-mono animate-pulse">Loading globe</span>
        </div>
      )}
    </div>
  )
}
