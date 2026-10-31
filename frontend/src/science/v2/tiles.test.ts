import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { TileLayout } from './model'
import { cellAt, cellsInBox, gunzip, meanValues, NO_DATA, Tile, tileName } from './tiles'

const layout: TileLayout = {
  cells_per_side: 100,
  res_deg: 0.1,
  layers: ['a', 'land_frac'],
  ranges: { a: [-10, 10], land_frac: [0.5, 1] },
  transforms: {},
  available: ['07_28'],
}

function rawTile(fill: (layer: number, r: number, c: number) => number): ArrayBuffer {
  const q = new Uint16Array(2 * 100 * 100)
  for (let l = 0; l < 2; l++) for (let r = 0; r < 100; r++) for (let c = 0; c < 100; c++) q[l * 10000 + r * 100 + c] = fill(l, r, c)
  return q.buffer
}

describe('grid cells match analysis/compute/grid.py', () => {
  it('maps corners and centres', () => {
    expect(cellAt(89.99, -179.99)).toMatchObject({ row: 0, col: 0 })
    expect(cellAt(-89.99, 179.99)).toMatchObject({ row: 1799, col: 3599 })
    const c = cellAt(36.45, 84.45)
    expect(c.lat).toBeCloseTo(36.45, 9)
    expect(c.lon).toBeCloseTo(84.45, 9)
    expect(tileName(c.row, c.col)).toBe('05_26')
  })

  it('wraps longitude', () => {
    expect(cellAt(0, 190)).toEqual(cellAt(0, -170))
  })

  it('lists cells inside a box and falls back to the centre cell', () => {
    expect(cellsInBox(36.0, 84.0, 36.2, 84.2)).toHaveLength(4)
    expect(cellsInBox(36.01, 84.01, 36.02, 84.02)).toHaveLength(1)
  })
})

describe('tile decoding', () => {
  it('dequantises like export_web.dequantise and keeps no-data', async () => {
    const raw = rawTile((l, r, c) => (l === 0 ? (r === 5 && c === 7 ? NO_DATA : 32767) : 65534))
    const tile = new Tile('07_28', await gunzip(new Uint8Array(gzipSync(new Uint8Array(raw))).buffer), layout)
    expect(tile.value(0, 700, 2800)).toBeCloseTo(-10 + (32767 * 20) / 65534, 12)
    expect(tile.valuesAt(705, 2807).a).toBeNull()
    expect(tile.valuesAt(700, 2800).land_frac).toBe(1)
  })

  it('decodes log-stored layers', () => {
    const lo = Math.log(1e-4)
    const hi = Math.log(4843 + 1e-4)
    const logLayout: TileLayout = { ...layout, ranges: { a: [lo, hi], land_frac: [0.5, 1] }, transforms: { a: { kind: 'log', offset: 1e-4 } } }
    const q = Math.round(((Math.log(0.004 + 1e-4) - lo) / (hi - lo)) * 65534)
    const tile = new Tile('07_28', rawTile((l) => (l === 0 ? q : 65534)), logLayout)
    expect(tile.value(0, 700, 2800)).toBeCloseTo(0.004, 6)
  })

  it('accepts bytes a CDN already decoded', async () => {
    const raw = rawTile(() => 0)
    expect(await gunzip(raw)).toBe(raw)
  })

  it('rejects a truncated tile', () => {
    expect(() => new Tile('07_28', new ArrayBuffer(10), layout)).toThrow(/expected 40000/)
  })

  it('averages only land cells', () => {
    const m = meanValues([{ a: 1, land_frac: 1 }, { a: 3, land_frac: 0.8 }, { a: 100, land_frac: null }])
    expect(m.a).toBe(2)
    expect(meanValues([{ a: 1, land_frac: null }])).toEqual({})
  })
})
