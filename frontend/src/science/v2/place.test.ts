/**
 * End to end on real data: decode the exported tiles and score the Python screen's top
 * cells in TypeScript. Tiles are gitignored (restore with scripts/web_tiles.sh pull), so
 * this suite skips in CI; the explain() parity suite covers the science there.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import jezero from '../../../public/data/v2/screening/jezero_crater.json'
import mouton from '../../../public/data/v2/screening/mons_mouton_plateau.json'
import { scorePlace } from './place'

const PUBLIC = fileURLToPath(new URL('../../../public/', import.meta.url))
const hasTiles = existsSync(`${PUBLIC}data/v2/tiles`)

describe.skipIf(!hasTiles)('scorePlace on real tiles matches the Python screen', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', async (url: string) => {
      const path = `${PUBLIC}${url.replace(/^\//, '')}`
      if (!existsSync(path)) return new Response(null, { status: 404 })
      return new Response(readFileSync(path))
    })
  })
  afterAll(() => vi.unstubAllGlobals())

  for (const screen of [jezero, mouton]) {
    for (const e of screen.top.slice(0, 5)) {
      it(`${screen.target} cell ${e.lat}, ${e.lon}`, async () => {
        const r = await scorePlace({ kind: 'point', lat: e.lat, lon: e.lon, targetId: screen.target })
        expect(r.land).toBe(true)
        expect(r.centre.lat).toBeCloseTo(e.lat, 6)
        // uint16 tiles differ from the float32 stack by < 1e-5 of each layer's range
        expect(Math.abs(r.verdict!.sai! - e.sai)).toBeLessThan(0.05)
        expect(r.ranking).toHaveLength(11)
      })
    }
  }

  it('returns no verdict over the ocean', async () => {
    const r = await scorePlace({ kind: 'point', lat: 0, lon: -140, targetId: 'jezero_crater' })
    expect(r.land).toBe(false)
    expect(r.verdict).toBeNull()
  })

  it('averages a drawn box', async () => {
    const e = jezero.top[0]!
    const r = await scorePlace({ kind: 'box', south: e.lat - 0.15, west: e.lon - 0.15, north: e.lat + 0.15, east: e.lon + 0.15, targetId: 'jezero_crater' })
    expect(r.cells).toBeGreaterThan(4)
    expect(r.verdict!.sai).toBeGreaterThan(50)
  })

  it('rejects non-finite and oversized queries', async () => {
    await expect(scorePlace({ kind: 'point', lat: Number.NaN, lon: 0, targetId: 'jezero_crater' })).rejects.toThrow(/finite/)
    await expect(scorePlace({ kind: 'box', south: 0, west: 0, north: 10, east: 10, targetId: 'jezero_crater' })).rejects.toThrow(/too large/)
  })
})
