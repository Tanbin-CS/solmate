// Copy the few real web tiles that src/science/v2/place.test.ts reads into a committed fixture,
// so CI runs the real-tile parity tests instead of skipping them (the full set is ~65 MB and
// lives in GCS). Run after `export_web --tiles`, with the full set restored:
//   node scripts/tile-fixture.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const tiles = `${root}public/data/v2/tiles/`
const out = `${root}src/science/v2/__fixtures__/tiles/`
const json = (p) => JSON.parse(readFileSync(`${root}${p}`, 'utf8'))

// Same grid as src/science/v2/tiles.ts: 0.1° cells, 100 x 100 cells per tile.
const RES = 0.1
const TILE = 100
const name = (lat, lon) => {
  const row = Math.min(1799, Math.max(0, Math.floor((90 - lat) / RES)))
  const col = Math.min(3599, Math.max(0, Math.floor((lon + 180) / RES)))
  return `${String(Math.floor(row / TILE)).padStart(2, '0')}_${String(Math.floor(col / TILE)).padStart(2, '0')}`
}

const tileset = json('public/data/v2/model.json').tiles?.tileset
if (!/^[0-9a-f]{12}$/.test(tileset ?? '')) throw new Error('model.json has no tiles.tileset; run export_web --tiles first')
if (!existsSync(tiles)) throw new Error('no web tiles here; restore them with scripts/web_tiles.sh pull')

// The cells the test scores: the top 5 of two targets, a box of +-0.15° around Jezero's #1, and open ocean.
const need = new Set([name(0, -140)])
for (const t of ['jezero_crater', 'mons_mouton_plateau']) {
  for (const e of json(`public/data/v2/screening/${t}.json`).top.slice(0, 5)) need.add(name(e.lat, e.lon))
}
const e = json('public/data/v2/screening/jezero_crater.json').top[0]
for (const dLat of [-0.15, 0.15]) for (const dLon of [-0.15, 0.15]) need.add(name(e.lat + dLat, e.lon + dLon))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const n of [...need].sort()) {
  if (existsSync(`${tiles}${n}.bin.gz`)) copyFileSync(`${tiles}${n}.bin.gz`, `${out}${n}.bin.gz`)
}
writeFileSync(`${out}tileset.txt`, `${tileset}\n`)
console.log(`tileset ${tileset}: ${readdirSync(out).filter((f) => f.endsWith('.gz')).join(', ')}`)
