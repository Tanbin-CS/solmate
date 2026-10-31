/**
 * Read the 0.1 degree NASA stack tiles written by export_web.py. A tile covers 10 x 10
 * degrees (100 x 100 cells); row 0 of the global grid is centred at 89.95 N and column 0
 * at 179.95 W, as in analysis/src/solmate/compute/grid.py.
 *
 * Format: gzip of, per layer in model.tiles.layers order, 100 x 100 little-endian uint16,
 * row-major from the north-west cell; v -> lo + v * (hi - lo) / 65534, 65535 = no data.
 * Layers in layout.transforms (heavy-tailed, e.g. aridity) were stored as log(x + offset).
 */
import type { PlaceValues, TileLayout } from './model'

export const RES = 0.1
export const NROWS = 1800
export const NCOLS = 3600
export const TILE = 100
export const NO_DATA = 65535

export interface Cell {
  row: number
  col: number
  lat: number // cell centre
  lon: number
}

/** The grid cell containing (lat, lon); longitudes wrap, latitudes clamp. */
export function cellAt(lat: number, lon: number): Cell {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180
  const row = Math.min(NROWS - 1, Math.max(0, Math.floor((90 - lat) / RES)))
  const col = Math.min(NCOLS - 1, Math.max(0, Math.floor((wrapped + 180) / RES)))
  return { row, col, lat: 90 - RES / 2 - RES * row, lon: -180 + RES / 2 + RES * col }
}

export const tileName = (row: number, col: number): string =>
  `${String(Math.floor(row / TILE)).padStart(2, '0')}_${String(Math.floor(col / TILE)).padStart(2, '0')}`

/** Undo gzip unless a CDN already decoded it (Content-Encoding); detected by the gzip magic bytes. */
export async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

export class Tile {
  readonly name: string
  private readonly data: Uint16Array
  private readonly layout: TileLayout

  constructor(name: string, raw: ArrayBuffer, layout: TileLayout) {
    const expected = layout.layers.length * TILE * TILE * 2
    if (raw.byteLength !== expected) throw new Error(`tile ${name}: ${raw.byteLength} bytes, expected ${expected}`)
    this.name = name
    this.layout = layout
    // Uint16Array uses platform byte order; every browser platform in use is little-endian.
    this.data = new Uint16Array(raw)
  }

  /** Dequantised value of one layer at a global cell (NaN = no data or not land). */
  value(layerIndex: number, row: number, col: number): number {
    const r = row % TILE
    const c = col % TILE
    const q = this.data[layerIndex * TILE * TILE + r * TILE + c]!
    if (q === NO_DATA) return Number.NaN
    const name = this.layout.layers[layerIndex]!
    const [lo, hi] = this.layout.ranges[name]!
    const v = lo + (q * (hi > lo ? hi - lo : 1.0)) / 65534
    const t = this.layout.transforms[name]
    return t ? Math.exp(v) - t.offset : v
  }

  /** Every layer at one cell; null when the cell has no data (ocean or ice-free mask). */
  valuesAt(row: number, col: number): Record<string, number | null> {
    return Object.fromEntries(
      this.layout.layers.map((k, i) => {
        const v = this.value(i, row, col)
        return [k, Number.isFinite(v) ? v : null]
      }),
    )
  }
}

/** True when the cell is land in the exported stack (land_frac > 0.5 was the export mask). */
export const isLand = (values: PlaceValues): boolean => typeof values.land_frac === 'number'

/** All cells whose centres fall inside a lat/lon box, clipped to the grid. */
export function cellsInBox(south: number, west: number, north: number, east: number): Cell[] {
  const a = cellAt(north, west)
  const b = cellAt(south, east)
  const out: Cell[] = []
  for (let row = a.row; row <= b.row; row++)
    for (let col = a.col; col <= b.col; col++) {
      const lat = 90 - RES / 2 - RES * row
      const lon = -180 + RES / 2 + RES * col
      if (lat >= south && lat <= north && lon >= west && lon <= east) out.push({ row, col, lat, lon })
    }
  return out.length ? out : [cellAt((south + north) / 2, (west + east) / 2)]
}

/** Mean of each layer over the land cells given (the coarse value of a drawn box). */
export function meanValues(cells: readonly Record<string, number | null>[]): Record<string, number | null> {
  const land = cells.filter(isLand)
  if (land.length === 0) return {}
  const keys = Object.keys(land[0]!)
  return Object.fromEntries(
    keys.map((k) => {
      let s = 0
      let n = 0
      for (const c of land) {
        const v = c[k]
        if (typeof v === 'number') {
          s += v
          n++
        }
      }
      return [k, n ? s / n : null]
    }),
  )
}
