/**
 * End to end on real data: decode the exported tiles and score the Python screen's top
 * cells in TypeScript. The full tile set is gitignored (restore it with scripts/web_tiles.sh
 * pull); without it, the test reads the few real tiles committed in __fixtures__/tiles
 * (refresh them with `node scripts/tile-fixture.mjs` after each export), so CI runs it too.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import jezero from '../../../public/data/v2/screening/jezero_crater.json'
import mouton from '../../../public/data/v2/screening/mons_mouton_plateau.json'
import modelJson from '../../../public/data/v2/model.json'
import { scorePlace } from './place'

const PUBLIC = fileURLToPath(new URL('../../../public/', import.meta.url))
const FIXTURE = fileURLToPath(new URL('./__fixtures__/tiles/', import.meta.url))
const fullSet = existsSync(`${PUBLIC}data/v2/tiles`)

describe('scorePlace on real tiles matches the Python screen', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', async (url: string) => {
      const rel = url.replace(/^\//, '')
      const tile = rel.match(/^data\/v2\/tiles\/(.+)$/)
      const path = tile && !fullSet ? `${FIXTURE}${tile[1]}` : `${PUBLIC}${rel}`
      if (!existsSync(path)) return new Response(null, { status: 404 })
      return new Response(readFileSync(path))
    })
  })
  afterAll(() => vi.unstubAllGlobals())

  it.skipIf(fullSet)('uses a tile fixture from the current export', () => {
    const fixture = readFileSync(`${FIXTURE}tileset.txt`, 'utf8').trim()
    // a new export changes the tileset hash: run `node scripts/tile-fixture.mjs` with the new tiles
    expect(fixture).toBe((modelJson as { tiles: { tileset?: string } }).tiles.tileset)
  })

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
