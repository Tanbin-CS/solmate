/**
 * Global screening results per target (export_web.py -> data/v2/screening/<id>.json) and
 * the arithmetic the UI needs on them: re-ranking under a weight preset and folding the
 * 100 m terrain score into the SAI (mirrors pipeline/rescore.py refined_sai).
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
    sai_refined: MaybeNum.optional(),
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

/** Dimension scores with the ~1 km terrain dimension replaced by the 100 m score when there is one. */
export function withTerrain100(dims: Readonly<Record<string, number | null | undefined>>, t100: number | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(dims)) out[k] = v === null || v === undefined ? Number.NaN : v
  if (t100 !== null && t100 !== undefined && Number.isFinite(t100)) out.T = t100
  return out
}

/** SAI (0-100) of a candidate under dimension weights, using 100 m terrain when available. */
export function candidateSai(c: Candidate, weights: Readonly<Record<string, number>>): number {
  const dims = withTerrain100(c.dims, c.terrain_100m?.score)
  const w = Object.fromEntries(Object.keys(dims).map((k) => [k, weights[k] ?? 0]))
  return sai(dims, w).sai
}

export interface Ranked {
  candidate: Candidate
  sai: number
  refined: boolean
}

/** Rank candidates by SAI under the given weights (refined terrain where measured). */
export function rank(list: readonly Candidate[], weights: Readonly<Record<string, number>>): Ranked[] {
  return list
    .map((candidate) => ({ candidate, sai: candidateSai(candidate, weights), refined: Number.isFinite(candidate.terrain_100m?.score ?? Number.NaN) }))
    .sort((a, b) => (Number.isFinite(b.sai) ? b.sai : -1) - (Number.isFinite(a.sai) ? a.sai : -1))
}
