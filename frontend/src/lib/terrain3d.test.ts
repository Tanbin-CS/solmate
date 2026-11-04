import { readFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IndexSchema, decodeGrid, loadGrid, findPlace, rowProfile, slopeDeg, slopeStats, type GridMeta, type Terrain3dIndex } from './terrain3d'

const meta = (n: number, min: number, max: number): GridMeta => ({
  file: 'x.bin',
  n,
  cell_m: 100,
  min_m: min,
  max_m: max,
  valid_fraction: 1,
  source: 'test',
})

function encode(z: number[], min: number, max: number): ArrayBuffer {
  const buf = new ArrayBuffer(z.length * 2)
  const v = new DataView(buf)
  z.forEach((h, i) => v.setUint16(i * 2, Number.isFinite(h) ? Math.round(((h - min) / (max - min)) * 65534) + 1 : 0, true))
  return buf
}

describe('decodeGrid', () => {
  it('maps 1..65535 onto min..max and 0 to no data', () => {
    const z = [0, 50, 100, NaN, 25, 75, 10, 90, 60]
    const g = decodeGrid(encode(z, 0, 100), meta(3, 0, 100))
    expect(g.z[0]).toBeCloseTo(0, 2)
    expect(g.z[2]).toBeCloseTo(100, 2)
    expect(g.z[4]).toBeCloseTo(25, 2)
    expect(Number.isNaN(g.z[3])).toBe(true)
  })
  it('rejects a grid of the wrong size', () => {
    expect(() => decodeGrid(new ArrayBuffer(10), meta(3, 0, 1))).toThrow()
  })
})

describe('slopeDeg', () => {
  it('gives 45 degrees on a plane rising one cell per cell eastward', () => {
    const n = 8
    const z = new Float32Array(n * n)
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) z[r * n + c] = c * 100
    const s = slopeDeg({ n, cell: 100, z })
    expect(s[3 * n + 3]).toBeCloseTo(45, 5)
    const st = slopeStats({ n, cell: 100, z }, s)
    expect(st.gentle).toBeLessThan(0.5)
  })
  it('is zero on flat ground and every cell counts as gentle', () => {
    const n = 5
    const g = { n, cell: 100, z: new Float32Array(n * n).fill(7) }
    const st = slopeStats(g, slopeDeg(g))
    expect(st.median).toBe(0)
    expect(st.gentle).toBe(1)
    expect(st.relief).toBe(0)
  })
})

describe('rowProfile', () => {
  it('measures height from the lowest point on the row, west to east in km', () => {
    const n = 3
    const g = {
      n,
      cell: 100,
      z: Float32Array.from([5, 6, 7, 10, 12, 11, 0, 0, 0]),
    }
    const p = rowProfile(g, slopeDeg(g), 1)
    expect(p.map((q) => q.h)).toEqual([0, 2, 1])
    expect(p[2]!.x).toBeCloseTo(0.2)
  })
})

describe('findPlace', () => {
  it('matches a point within 0.05 degrees only', () => {
    const idx = {
      version: 1,
      targets: {},
      places: { a: { ...meta(3, 0, 1), lat: 10, lon: 20, for: ['t'] } },
    } as Terrain3dIndex
    expect(findPlace(idx, 10.02, 19.98)).not.toBeNull()
    expect(findPlace(idx, 10.2, 20)).toBeNull()
  })
})

describe('the shipped index', () => {
  it('parses, and every grid file is gzipped and unpacks to the size its n says', () => {
    const root = new URL('../../public/data/v2/terrain3d/', import.meta.url)
    const idx = IndexSchema.parse(JSON.parse(readFileSync(new URL('index.json', root), 'utf8')))
    const all = [...Object.values(idx.targets), ...Object.values(idx.places)]
    expect(Object.keys(idx.places).length).toBeGreaterThan(0)
    for (const m of all) {
      const buf = readFileSync(new URL(m.file, root))
      expect([buf[0], buf[1]]).toEqual([0x1f, 0x8b])
      expect(gunzipSync(buf).byteLength).toBe(m.n * m.n * 2)
    }
  })
})

describe('loadGrid', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('gunzips a packed grid and fetches each file once', async () => {
    const z = [0, 50, 100, 25]
    const raw = new Uint8Array(encode(z, 0, 100))
    const fetchMock = vi.fn(async () => new Response(gzipSync(raw)))
    vi.stubGlobal('fetch', fetchMock)
    const m = { ...meta(2, 0, 100), file: 'packed_test.bin' }
    const g = await loadGrid(m)
    expect(g.z[1]).toBeCloseTo(50, 2)
    await loadGrid(m)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('does not keep a failed fetch, so a retry can succeed', async () => {
    const m = { ...meta(2, 0, 100), file: 'flaky_test.bin' }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(loadGrid(m)).rejects.toThrow(/503/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(encode([1, 2, 3, 4], 0, 100)))))
    await expect(loadGrid(m)).resolves.toHaveProperty('n', 2)
  })
})
