import type { IndicatorsDoc, Site } from '@/data/schema'
import { contributions, perIndicatorSimilarity, rank, robustScaling, weightedScore, zGap, type Scaling } from './similarity'

export interface SiteResult {
  site: Site
  values: number[]
  sims: number[]
  gaps: number[]
  contributions: number[]
  score: number
  rank: number
}

export interface AnalysisResult {
  indicatorIds: string[]
  reference: number[]
  scaling: Scaling
  results: SiteResult[] // sorted by rank
  byId: Map<string, SiteResult>
}

export function equalWeights(ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 1]))
}

/** Deterministic analysis of every scored site against the reference for the given indicator weights. */
export function analyse(doc: IndicatorsDoc, weights: Record<string, number>): AnalysisResult {
  const indicatorIds = doc.profile.scored
  const pool = doc.sites.filter((s) => !s.excluded)
  const matrix = pool.map((s) => indicatorIds.map((k) => s.indicators[k]!))
  const reference = indicatorIds.map((k) => doc.reference.indicators[k]!)
  const scaling = robustScaling(matrix)
  const w = indicatorIds.map((k) => weights[k] ?? 0)

  const partial = pool.map((site, i) => {
    const values = matrix[i]!
    const sims = perIndicatorSimilarity(reference, values, scaling.scale)
    return {
      site,
      values,
      sims,
      gaps: zGap(reference, values, scaling.scale),
      contributions: contributions(sims, w),
      score: weightedScore(sims, w),
    }
  })
  const ranks = rank(
    partial.map((p) => p.score),
    partial.map((p) => p.site.id),
  )
  const results = partial.map((p, i) => ({ ...p, rank: ranks[i]! })).sort((a, b) => a.rank - b.rank)
  return { indicatorIds, reference, scaling, results, byId: new Map(results.map((r) => [r.site.id, r])) }
}
