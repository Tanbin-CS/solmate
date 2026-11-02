import { fmtCoord } from './format'

/**
 * Broad region names for the screening's best cells, which come from a 0.1 degree grid and
 * have no gazetteer name. Each box was checked against the cells it labels (all are high,
 * barren deserts: surface pressure 530-650 hPa on the plateaus, 900+ hPa in the basins).
 * Anything outside the boxes is shown by its coordinates only.
 */
const REGIONS: { name: string; south: number; north: number; west: number; east: number }[] = [
  { name: 'Tibetan Plateau', south: 30, north: 38.1, west: 75, east: 95 },
  { name: 'Tarim Basin', south: 38.1, north: 42, west: 75, east: 95 },
  { name: 'Puna de Atacama', south: -30, north: -21, west: -71, east: -65 },
  { name: 'Sistan Basin', south: 29, north: 35, west: 57, east: 64 },
]

export function regionOf(lat: number, lon: number): string | null {
  return REGIONS.find((r) => lat >= r.south && lat < r.north && lon >= r.west && lon < r.east)?.name ?? null
}

/** "Tibetan Plateau · 37.05°N 86.75°E", or just the coordinates. */
export function placeLabel(lat: number, lon: number): { name: string; coords: string } {
  const coords = fmtCoord(lat, lon)
  return { name: regionOf(lat, lon) ?? coords, coords }
}

/**
 * NASA GIBS WMS image of a square window around a point (public, keyless, CORS-enabled).
 * imagery: Landsat WELD 1990 true colour (NASA/USGS); relief: ASTER GDEM shaded relief (NASA/METI).
 */
export function gibsWindow(lat: number, lon: number, km: number, kind: 'imagery' | 'relief', px = 512): string {
  const dLat = km / 2 / 111.32
  const dLon = dLat / Math.cos((lat * Math.PI) / 180)
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: kind === 'imagery' ? 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual' : 'ASTER_GDEM_Greyscale_Shaded_Relief',
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(5)).join(','),
    WIDTH: String(px),
    HEIGHT: String(px),
    FORMAT: 'image/jpeg',
    ...(kind === 'imagery' && { TIME: '1990-12-01' }),
  })
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q}`
}
