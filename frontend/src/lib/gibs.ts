/**
 * NASA GIBS pictures of a square window around a point, built from the pre-cut WMTS tiles
 * (web Mercator, public, keyless, CORS-enabled). The WMS GetMap endpoint renders each request on
 * demand and often takes 10 to 90 seconds, so a window drawn from it stayed an empty dark box.
 * imagery: Landsat WELD 1990 true colour (NASA/USGS; no data south of 60° S);
 * relief: ASTER GDEM greyscale shaded relief (NASA/METI).
 */
export type GibsKind = 'imagery' | 'relief'

export interface GibsSpot {
  lat: number
  lon: number
  /** Width of the window on the ground. */
  km: number
  kind: GibsKind
  /** Pixels the window is drawn at; picks a zoom with at least this much detail. */
  px?: number
}

/** One tile, placed in percent of the window's width (left, top and size). */
export interface GibsTile {
  url: string
  left: number
  top: number
  size: number
}

const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const LAYER: Record<GibsKind, string> = {
  imagery: 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/1990-12-01',
  relief: 'ASTER_GDEM_Greyscale_Shaded_Relief/default',
}
const EARTH_KM = 40075.017
const MAX_ZOOM = 12 // GoogleMapsCompatible_Level12 for both layers
const MAX_LAT = 85.05

export function gibsTiles({ lat, lon, km, kind, px = 256 }: GibsSpot): GibsTile[] {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180
  // Smallest zoom at which the window covers at least `px` source pixels.
  const z = Math.max(0, Math.min(MAX_ZOOM, Math.ceil(Math.log2((px * EARTH_KM * Math.cos(phi)) / (256 * km)))))
  const n = 2 ** z
  const x = ((lon + 180) / 360) * n
  const y = ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n
  const w = (km * n) / (EARTH_KM * Math.cos(phi)) // window width in tiles (Mercator is locally square)
  const left = x - w / 2
  const top = y - w / 2
  const tiles: GibsTile[] = []
  for (let ty = Math.floor(top); ty < top + w; ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(left); tx < left + w; tx++) {
      const wx = ((tx % n) + n) % n
      tiles.push({
        url: `${BASE}/${LAYER[kind]}/GoogleMapsCompatible_Level${MAX_ZOOM}/${z}/${ty}/${wx}.jpg`,
        left: ((tx - left) / w) * 100,
        top: ((ty - top) / w) * 100,
        size: 100 / w,
      })
    }
  }
  return tiles
}

/** A link that opens the same window in NASA Worldview, where a reader can browse every GIBS layer and date. */
export function worldviewUrl(lat: number, lon: number, km: number): string {
  const dLat = km / 2 / 110.574
  const dLon = km / 2 / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)))
  const f = (x: number) => x.toFixed(4)
  const v = [lon - dLon, Math.max(-90, lat - dLat), lon + dLon, Math.min(90, lat + dLat)].map(f).join(',')
  return `https://worldview.earthdata.nasa.gov/?v=${v}`
}
