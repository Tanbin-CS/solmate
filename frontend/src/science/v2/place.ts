/**
 * Score any place on Earth against the SolMate targets from the 0.1 degree NASA stack.
 * Runs in the scoring worker; pure apart from tile loading.
 */
import { loadModel, loadTargets, loadTile } from './data'
import type { Model, Target } from './model'
import { cellAt, cellsInBox, isLand, meanValues, tileName, type Cell } from './tiles'
import { explain, type Verdict } from './verdict'

export interface Box {
  south: number
  west: number
  north: number
  east: number
}

export type PlaceQuery = ({ kind: 'point'; lat: number; lon: number } | ({ kind: 'box' } & Box)) & {
  targetId: string
  weights?: Readonly<Record<string, number>>
}

export interface PlaceResult {
  model_version: string
  centre: Cell
  cells: number // 0.1 degree land cells averaged
  land: boolean
  values: Record<string, number | null>
  verdict: Verdict | null
  ranking: { id: string; name: string; body: Target['body']; sai: number | null }[] // every target, best first
}

async function valuesFor(cells: readonly Cell[], model: Model): Promise<Record<string, number | null>[]> {
  const out: Record<string, number | null>[] = []
  for (const c of cells) {
    const tile = await loadTile(tileName(c.row, c.col), model)
    if (tile) out.push(tile.valuesAt(c.row, c.col))
  }
  return out
}

const MAX_CELLS = 2500 // 5 x 5 degrees: far beyond any analog site, keeps the worker responsive

export async function scorePlace(q: PlaceQuery): Promise<PlaceResult> {
  const coords = q.kind === 'point' ? [q.lat, q.lon] : [q.south, q.west, q.north, q.east]
  if (!coords.every(Number.isFinite)) throw new Error('coordinates must be finite numbers')
  const [model, targets] = await Promise.all([loadModel(), loadTargets()])
  const target = targets.find((t) => t.id === q.targetId)
  if (!target) throw new Error(`unknown target ${q.targetId}`)
  const cells =
    q.kind === 'point' ? [cellAt(q.lat, q.lon)] : cellsInBox(q.south, q.west, q.north, q.east)
  if (cells.length > MAX_CELLS) throw new Error('box too large: draw at most 5 x 5 degrees')
  const centre = q.kind === 'point' ? cells[0]! : cellAt((q.south + q.north) / 2, (q.west + q.east) / 2)
  const perCell = await valuesFor(cells, model)
  const values = meanValues(perCell)
  const land = isLand(values)
  // Presets carry every dimension; explain() keeps only those that apply to each target's body.
  const verdict = land ? explain(values, target, model, q.weights) : null
  const ranking = targets
    .map((t) => ({ id: t.id, name: t.name, body: t.body, sai: land ? explain(values, t, model, q.weights).sai : null }))
    .sort((a, b) => (b.sai ?? -1) - (a.sai ?? -1))
  return {
    model_version: model.model_version,
    centre,
    cells: perCell.filter(isLand).length,
    land,
    values,
    verdict,
    ranking,
  }
}
