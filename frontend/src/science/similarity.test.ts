import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { IndicatorsDoc, ValidationDoc } from '@/data/schema'
import { analyse, equalWeights } from './analysis'
import { auc, contributions, perIndicatorSimilarity, rank, robustScaling, weightedScore } from './similarity'

const load = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../public/data/${name}`, import.meta.url)), 'utf8'))

describe('similarity primitives', () => {
  it('identical profiles score exactly 1', () => {
    const sims = perIndicatorSimilarity([1, 2, 3], [1, 2, 3], [1, 1, 1])
    expect(weightedScore(sims, [1, 2, 3])).toBe(1)
  })

  it('is invariant to weight scaling and indicator order', () => {
    const ref = [1, 5, 9]
    const cand = [2, 3, 12]
    const scale = [1, 2, 3]
    const sims = perIndicatorSimilarity(ref, cand, scale)
    const a = weightedScore(sims, [1, 2, 3])
    expect(weightedScore(sims, [10, 20, 30])).toBeCloseTo(a, 12)
    const perm = [2, 0, 1]
    const simsP = perIndicatorSimilarity(
      perm.map((i) => ref[i]!),
      perm.map((i) => cand[i]!),
      perm.map((i) => scale[i]!),
    )
    expect(weightedScore(simsP, perm.map((i) => [1, 2, 3][i]!))).toBeCloseTo(a, 12)
  })

  it('contributions sum to the score', () => {
    const sims = [0.9, 0.2, 0.5]
    const w = [1, 3, 0.5]
    const total = contributions(sims, w).reduce((s, c) => s + c, 0)
    expect(total).toBeCloseTo(weightedScore(sims, w), 12)
  })

  it('robust scaling uses median and 1.4826 × MAD', () => {
    const { centre, scale } = robustScaling([[1], [2], [3], [4], [100]])
    expect(centre[0]).toBe(3)
    expect(scale[0]).toBeCloseTo(1.4826, 10)
  })

  it('ranks ties deterministically by id and computes AUC', () => {
    expect(rank([0.5, 0.9, 0.5], ['b', 'a', 'a2'])).toEqual([3, 1, 2])
    expect(auc([3, 4], [1, 2])).toBe(1)
    expect(auc([1], [1])).toBe(0.5)
  })
})

describe('agreement with the Python pipeline artifacts', () => {
  const doc = IndicatorsDoc.parse(load('indicators.v1.json'))
  const val = ValidationDoc.parse(load('validation.v1.json'))
  const res = analyse(doc, equalWeights(doc.profile.scored))

  it('reproduces the robust scaling', () => {
    doc.profile.scored.forEach((k, j) => {
      expect(res.scaling.centre[j]).toBeCloseTo(val.scaling.centre[k]!, 9)
      expect(res.scaling.scale[j]).toBeCloseTo(val.scaling.scale[k]!, 9)
    })
  })

  it('reproduces every equal-weight score and rank within 1e-9', () => {
    expect(res.results.map((r) => r.site.id).sort()).toEqual([...val.pool].sort())
    for (const r of res.results) {
      expect(r.score).toBeCloseTo(val.equal_weights.scores[r.site.id]!, 9)
      expect(r.rank).toBe(val.equal_weights.ranks[r.site.id])
    }
  })

  it('reproduces the known-analog retrieval AUC', () => {
    const pos = res.results.filter((r) => r.site.role === 'documented' && r.site.pair === 'Mars').map((r) => r.score)
    const neg = res.results.filter((r) => r.site.role === 'control').map((r) => r.score)
    expect(auc(pos, neg)).toBeCloseTo(val.retrieval.auc_mars_documented, 12)
  })
})
