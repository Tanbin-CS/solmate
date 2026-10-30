/**
 * SolMate Analog Index (SAI) — mirrors analysis/src/solmate/compute/aggregate.py.
 *
 * SAI = 100 · Σ W_k D_k / Σ W_k over dimensions with weight > 0 and data;
 * coverage = available weight / applicable weight; flagged below MIN_COVERAGE.
 */

export const MIN_COVERAGE = 0.6

export type Band = 'strong' | 'partial' | 'weak' | 'n/a'

export function band(score01: number): Exclude<Band, 'n/a'> {
  if (score01 >= 0.75) return 'strong'
  if (score01 >= 0.4) return 'partial'
  return 'weak'
}

/** NaN-aware weighted mean; returns the mean and the share of weight that had data. */
export function weightedMean(values: readonly number[], weights: readonly number[]): { mean: number; share: number } {
  let wsum = 0
  let wok = 0
  let acc = 0
  values.forEach((v, i) => {
    const w = weights[i] ?? 0
    wsum += w
    if (Number.isFinite(v)) {
      wok += w
      acc += v * w
    }
  })
  return { mean: wok > 0 ? acc / wok : Number.NaN, share: wsum > 0 ? wok / wsum : 0 }
}

export interface DimensionResult {
  id: string
  score: number
  weight: number
  contribution: number
  band: Band
}

export interface SAIResult {
  sai: number
  coverage: number
  insufficient: boolean
  dimensions: DimensionResult[]
}

/** dimScores: NaN (or missing) = no data. dimWeights: 0 = dimension off. */
export function sai(dimScores: Readonly<Record<string, number | null | undefined>>, dimWeights: Readonly<Record<string, number>>): SAIResult {
  const ids = Object.keys(dimWeights).filter((k) => (dimWeights[k] ?? 0) > 0)
  const scores = ids.map((k) => {
    const s = dimScores[k]
    return s === null || s === undefined ? Number.NaN : s
  })
  const weights = ids.map((k) => dimWeights[k]!)
  const { mean, share } = weightedMean(scores, weights)
  const wok = weights.reduce((a, w, i) => (Number.isFinite(scores[i]!) ? a + w : a), 0)
  const dimensions = ids.map((id, i): DimensionResult => {
    const s = scores[i]!
    const w = weights[i]!
    return {
      id,
      score: s,
      weight: w,
      contribution: Number.isFinite(s) && wok > 0 ? (w * s) / wok : 0,
      band: Number.isFinite(s) ? band(s) : 'n/a',
    }
  })
  return { sai: Number.isFinite(mean) ? mean * 100 : Number.NaN, coverage: share, insufficient: share < MIN_COVERAGE, dimensions }
}
