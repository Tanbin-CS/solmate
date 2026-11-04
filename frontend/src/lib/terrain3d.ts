/**
 * Height grids for the side-by-side 3D terrain view (analysis/src/solmate/pipeline/terrain3d.py).
 * 20 km blocks at 100 m from NASA ASTER GDEM (Earth), LRO LOLA (Moon) and the Mars 2020 CTX DTM.
 * Context only: nothing here feeds the Analog Index.
 * Files are gzipped uint16 grids; one per target and one per listed Earth place (top 25 + novel 25).
 */
import { z } from 'zod'
import { asset } from '@/lib/asset'
import { gunzip } from '@/science/v2/tiles'

const GridMetaSchema = z.object({
  // plain file names only (no slashes), e.g. haworth.bin or earth_m27.450_m68.750.bin
  file: z.string().regex(/^[a-z0-9_]+(\.[0-9]+_m?[0-9]+\.[0-9]+)?\.bin$/),
  n: z.number().int().min(8).max(512),
  cell_m: z.number().positive(),
  min_m: z.number(),
  max_m: z.number(),
  valid_fraction: z.number().min(0).max(1),
  source: z.string(),
})
export type GridMeta = z.infer<typeof GridMetaSchema>

export const IndexSchema = z.object({
  version: z.literal(1),
  targets: z.record(z.string(), GridMetaSchema),
  places: z.record(
    z.string(),
    GridMetaSchema.extend({
      lat: z.number(),
      lon: z.number(),
      for: z.array(z.string()),
    }),
  ),
})
export type Terrain3dIndex = z.infer<typeof IndexSchema>

const ROOT = 'data/v2/terrain3d/'
let indexP: Promise<Terrain3dIndex> | null = null

export function loadTerrain3dIndex(): Promise<Terrain3dIndex> {
  return (indexP ??= fetch(asset(ROOT + 'index.json'))
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load the 3D terrain index (HTTP ${r.status})`)
      return r.json()
    })
    .then((x) => IndexSchema.parse(x))
    .catch((err: unknown) => {
      indexP = null
      throw err
    }))
}

/** The baked Earth block for a place, when the point is within ~5 km of one. */
export function findPlace(index: Terrain3dIndex, lat: number, lon: number): GridMeta | null {
  const tol = 0.05
  for (const p of Object.values(index.places)) if (Math.abs(p.lat - lat) < tol && Math.abs(p.lon - lon) < tol) return p
  return null
}

export interface Grid {
  n: number
  cell: number
  /** row-major heights in metres, north row first; NaN where there is no data */
  z: Float32Array
}

/** Decode the uint16 grid: 0 = no data, 1..65535 linear on [min_m, max_m]. */
export function decodeGrid(buf: ArrayBuffer, meta: GridMeta): Grid {
  const n = meta.n
  if (buf.byteLength !== n * n * 2) throw new Error('3D terrain grid has the wrong size')
  const view = new DataView(buf)
  const span = meta.max_m > meta.min_m ? meta.max_m - meta.min_m : 1
  const z = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) {
    const q = view.getUint16(i * 2, true)
    z[i] = q === 0 ? NaN : meta.min_m + ((q - 1) / 65534) * span
  }
  return { n, cell: meta.cell_m, z }
}

const grids = new Map<string, Promise<Grid>>()
const MAX_GRIDS = 8 // ~2.5 MB decoded

/** One block, fetched once and kept for the panel preview and the 3D view; failures are not kept. */
export function loadGrid(meta: GridMeta): Promise<Grid> {
  const hit = grids.get(meta.file)
  if (hit) return hit
  const p = fetch(asset(ROOT + meta.file))
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load ${meta.file} (HTTP ${r.status})`)
      return r.arrayBuffer()
    })
    // files are gzipped by the pipeline; gunzip passes raw bytes through unchanged
    .then(gunzip)
    .then((buf) => decodeGrid(buf, meta))
  p.catch(() => grids.delete(meta.file))
  grids.set(meta.file, p)
  while (grids.size > MAX_GRIDS) grids.delete(grids.keys().next().value!)
  return p
}

/** Slope in degrees per cell (Horn 1981), edges clamped; NaN where a neighbour has no data. */
export function slopeDeg(g: Grid): Float32Array {
  const { n, cell, z } = g
  const out = new Float32Array(n * n)
  const at = (r: number, c: number) => z[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))]!
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const a = at(r - 1, c - 1),
        b = at(r - 1, c),
        cc = at(r - 1, c + 1)
      const d = at(r, c - 1),
        f = at(r, c + 1)
      const g7 = at(r + 1, c - 1),
        h = at(r + 1, c),
        i = at(r + 1, c + 1)
      const dx = (cc + 2 * f + i - (a + 2 * d + g7)) / (8 * cell)
      const dy = (g7 + 2 * h + i - (a + 2 * b + cc)) / (8 * cell)
      out[r * n + c] = (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI
    }
  return out
}

export interface SlopeStats {
  median: number
  p90: number
  /** share of the block gentler than SAFE_DEG */
  gentle: number
  relief: number
}

/** Slope limit used for "easy ground": the Ops dimension's safe-ground threshold. */
export const SAFE_DEG = 10

function quantile(sorted: Float32Array, q: number): number {
  if (!sorted.length) return NaN
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo)
}

export function slopeStats(g: Grid, slope: Float32Array): SlopeStats {
  const ok = slope.filter((v) => Number.isFinite(v)).sort()
  const zs = g.z.filter((v) => Number.isFinite(v)).sort()
  return {
    median: quantile(ok, 0.5),
    p90: quantile(ok, 0.9),
    gentle: ok.length ? ok.filter((v) => v < SAFE_DEG).length / ok.length : NaN,
    relief: zs.length ? quantile(zs, 0.99) - quantile(zs, 0.01) : NaN,
  }
}

/** West-to-east profile along one row: distance (km), height above the row's lowest point (m), slope (deg). */
export function rowProfile(g: Grid, slope: Float32Array, row: number): { x: number; h: number; s: number }[] {
  const { n, cell, z } = g
  const r = Math.min(n - 1, Math.max(0, Math.round(row)))
  let lo = Infinity
  for (let c = 0; c < n; c++) {
    const v = z[r * n + c]!
    if (Number.isFinite(v) && v < lo) lo = v
  }
  const out = []
  for (let c = 0; c < n; c++)
    out.push({
      x: (c * cell) / 1000,
      h: z[r * n + c]! - lo,
      s: slope[r * n + c]!,
    })
  return out
}
