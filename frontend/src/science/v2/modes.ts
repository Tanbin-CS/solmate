/**
 * SolMate v2 per-indicator similarity modes — mirrors analysis/src/solmate/compute/modes.py.
 *
 * match:  target inside Earth's [p1, p99] → s = exp(-0.5 · ((x − t) / σ)²)
 * toward: target beyond Earth's range     → s = ECDF(x) (target above) or 1 − ECDF(x) (below)
 *
 * Earth statistics (101-point quantiles, median, robust σ) come from
 * data/stack/earth_stats.v2.json, so browser and Python scores agree within 1e-9.
 * Pure functions only: no React, no I/O.
 */

export const N_QUANTILES = 101

export interface EarthStats {
  quantiles: readonly number[] // 101 values, ascending
  median: number
  sigma: number
}

export type ModeKind = 'match' | 'toward'
export interface Mode {
  kind: ModeKind
  direction: -1 | 0 | 1
}

/** Piecewise-linear interpolation like numpy.interp with clamped ends. */
function interp(x: number, xp: readonly number[], fp: readonly number[], left: number, right: number): number {
  const n = xp.length
  if (x < xp[0]!) return left
  if (x > xp[n - 1]!) return right
  if (x === xp[n - 1]) return fp[n - 1]!
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xp[mid]! <= x) lo = mid
    else hi = mid
  }
  const x0 = xp[lo]!
  const x1 = xp[hi]!
  return fp[lo]! + ((x - x0) * (fp[hi]! - fp[lo]!)) / (x1 - x0)
}

/** Unique quantile values with the mean probability of each tie group (numpy.unique + bincount). */
function collapseTies(q: readonly number[]): { xs: number[]; ps: number[] } {
  const probs = q.map((_, i) => i / (N_QUANTILES - 1))
  const order = q.map((v, i) => [v, probs[i]!] as const).sort((a, b) => a[0] - b[0])
  const xs: number[] = []
  const ps: number[] = []
  let i = 0
  while (i < order.length) {
    const v = order[i]![0]
    let sum = 0
    let n = 0
    while (i < order.length && order[i]![0] === v) {
      sum += order[i]![1]
      n++
      i++
    }
    xs.push(v)
    ps.push(sum / n)
  }
  return { xs, ps }
}

const tieCache = new WeakMap<readonly number[], { xs: number[]; ps: number[] }>()

/** Fraction of Earth's land at or below x. */
export function ecdf(x: number, stats: EarthStats): number {
  let t = tieCache.get(stats.quantiles)
  if (!t) {
    t = collapseTies(stats.quantiles)
    tieCache.set(stats.quantiles, t)
  }
  return interp(x, t.xs, t.ps, 0, 1)
}

export function chooseMode(target: number, stats: EarthStats): Mode {
  const p1 = stats.quantiles[1]!
  const p99 = stats.quantiles[99]!
  if (target >= p1 && target <= p99) return { kind: 'match', direction: 0 }
  return { kind: 'toward', direction: target > p99 ? 1 : -1 }
}

/** Similarity in [0, 1]; NaN when x is not finite. */
export function similarity(x: number, target: number, stats: EarthStats, mode: Mode = chooseMode(target, stats)): number {
  if (!Number.isFinite(x)) return Number.NaN
  if (mode.kind === 'match') {
    const z = (x - target) / stats.sigma
    return Math.exp(-0.5 * z * z)
  }
  const p = ecdf(x, stats)
  return mode.direction > 0 ? p : 1 - p
}

/** Share of the way from Earth's median to the target that a place still lacks (0..1). */
export function towardGap(x: number, target: number, stats: EarthStats): number {
  const span = target - stats.median
  if (Math.abs(span) < 1e-12) return 0
  return Math.min(1, Math.max(0, (target - x) / span))
}
