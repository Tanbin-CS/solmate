/**
 * Global screening results per target (export_web.py -> data/v2/screening/<id>.json) and
 * the arithmetic the UI needs on them: re-ranking under a weight preset. The 100 m terrain
 * score (terrain_100m) is a separate check and never enters the SAI (pipeline/rescore.py).
 */
import { z } from 'zod'
import { sai } from './aggregate'

const Num = z.number().finite()
const MaybeNum = Num.nullable()

const Terrain100 = z.object({
  score: MaybeNum,
  similarity: z.record(z.string(), Num),
  indicators: z.record(z.string(), MaybeNum),
})

export const CandidateSchema = z
  .object({
    lat: Num,
    lon: Num,
    sai: MaybeNum,
    coverage: Num,
    dims: z.record(z.string(), MaybeNum),
    nearest_known: z.string().nullable().optional(),
    nearest_known_km: MaybeNum.optional(),
    terrain_100m: Terrain100.optional(),
    verdict: z.unknown().optional(),
  })
  .passthrough()

export const ScreeningSchema = z.object({
  target: z.string(),
  stage: z.number().int(),
  novelty_km: Num,
  top: z.array(CandidateSchema),
  novel_leads: z.array(CandidateSchema),
  dimension_leaders: z.record(z.string(), z.array(CandidateSchema)),
})

export type Candidate = z.infer<typeof CandidateSchema>
export type Screening = z.infer<typeof ScreeningSchema>

/** Dimension scores with missing values as NaN. */
export function dimScores(dims: Readonly<Record<string, number | null | undefined>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(dims)) out[k] = v === null || v === undefined ? Number.NaN : v
  return out
}

/** SAI (0-100) of a candidate under dimension weights, from its ~1 km dimensions. */
export function candidateSai(c: Candidate, weights: Readonly<Record<string, number>>): number {
  const dims = dimScores(c.dims)
  const w = Object.fromEntries(Object.keys(dims).map((k) => [k, weights[k] ?? 0]))
  return sai(dims, w).sai
}

export interface Ranked {
  candidate: Candidate
  sai: number
  /** 100 m terrain check (0-1) where measured, else null; shown, never ranked on. */
  t100: number | null
}

/** Rank candidates by SAI under the given weights. */
export function rank(list: readonly Candidate[], weights: Readonly<Record<string, number>>): Ranked[] {
  return list
    .map((candidate) => {
      const t = candidate.terrain_100m?.score
      return { candidate, sai: candidateSai(candidate, weights), t100: t !== null && t !== undefined && Number.isFinite(t) ? t : null }
    })
    .sort((a, b) => (Number.isFinite(b.sai) ? b.sai : -1) - (Number.isFinite(a.sai) ? a.sai : -1))
}
