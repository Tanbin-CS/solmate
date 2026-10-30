import { describe, expect, it } from 'vitest'
import golden from '../golden/scoring.v2.json'
import { sai } from './aggregate'
import { chooseMode, ecdf, similarity, towardGap, type EarthStats } from './modes'

const TOL = 1e-9
const stats = golden.earth_stats as Record<string, EarthStats>

describe('v2 modes match Python golden cases', () => {
  for (const c of golden.similarity) {
    const es = stats[c.indicator]!
    it(`${c.indicator} → ${c.mode.kind}`, () => {
      expect(chooseMode(c.target, es)).toEqual(c.mode)
      c.x.forEach((x, i) => {
        expect(ecdf(x, es)).toBeCloseTo(c.ecdf[i]!, 9)
        const want = c.similarity[i]
        const got = similarity(x, c.target, es)
        if (want === null) expect(Number.isNaN(got)).toBe(true)
        else expect(Math.abs(got - want)).toBeLessThan(TOL)
        expect(Math.abs(towardGap(x, c.target, es) - c.gap[i]!)).toBeLessThan(TOL)
      })
    })
  }

  it('NaN input gives NaN similarity', () => {
    const es = stats.albedo_wsa_sw!
    expect(Number.isNaN(similarity(Number.NaN, 0.2, es))).toBe(true)
  })
})

describe('v2 SAI matches Python golden cases', () => {
  golden.sai.forEach((c, n) => {
    it(`case ${n + 1}`, () => {
      const r = sai(c.scores, c.weights)
      if (c.sai === null) expect(Number.isNaN(r.sai)).toBe(true)
      else expect(Math.abs(r.sai - c.sai)).toBeLessThan(TOL)
      expect(r.coverage).toBeCloseTo(c.coverage, 12)
      expect(r.insufficient).toBe(c.insufficient)
      expect(r.dimensions.map((d) => d.id)).toEqual(c.dimensions.map((d) => d.id))
      r.dimensions.forEach((d, i) => {
        expect(Math.abs(d.contribution - c.dimensions[i]!.contribution)).toBeLessThan(TOL)
        expect(d.band).toBe(c.dimensions[i]!.band)
      })
    })
  })
})
