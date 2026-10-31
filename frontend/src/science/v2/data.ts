/**
 * Load and validate the v2 model files and tiles. Works on the main thread and in the
 * scoring worker. Each file is fetched once; failures are not cached so a retry can succeed.
 */
import { asset } from '@/lib/asset'
import { ModelSchema, TargetsSchema, type Model, type Target } from './model'
import { gunzip, Tile } from './tiles'

const ROOT = 'data/v2/'
const MAX_TILES = 16 // ~10 MB of decoded tiles

async function fetchOk(path: string): Promise<Response> {
  const res = await fetch(asset(ROOT + path))
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`)
  return res
}

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null
  return () =>
    (p ??= load().catch((err: unknown) => {
      p = null
      throw err
    }))
}

export const loadModel = once(async (): Promise<Model> => ModelSchema.parse(await (await fetchOk('model.json')).json()))

export const loadTargets = once(
  async (): Promise<Target[]> => TargetsSchema.parse(await (await fetchOk('targets.json')).json()).targets,
)

const tiles = new Map<string, Promise<Tile | null>>()

/** The tile with this name, or null when it has no land (not exported). LRU-bounded. */
export function loadTile(name: string, model: Model): Promise<Tile | null> {
  const hit = tiles.get(name)
  if (hit) {
    tiles.delete(name)
    tiles.set(name, hit) // most recently used goes last
    return hit
  }
  const p = model.tiles.available.includes(name)
    ? fetchOk(`tiles/${name}.bin.gz`)
        .then((r) => r.arrayBuffer())
        .then(gunzip)
        .then((raw) => new Tile(name, raw, model.tiles))
    : Promise.resolve(null)
  p.catch(() => tiles.delete(name))
  tiles.set(name, p)
  while (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value!)
  return p
}
