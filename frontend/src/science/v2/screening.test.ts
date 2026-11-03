import { describe, expect, it } from 'vitest'
import jezeroJson from '../../../public/data/v2/screening/jezero_crater.json'
import moutonJson from '../../../public/data/v2/screening/mons_mouton_plateau.json'
import { candidateSai, rank, ScreeningSchema } from './screening'

const screens = [ScreeningSchema.parse(jezeroJson), ScreeningSchema.parse(moutonJson)]
const equal = { T: 1, C: 1, Th: 1, S: 1, M: 1, I: 1, D: 1, O: 0 }

describe('screening arithmetic matches pipeline/rescore.py', () => {
  for (const s of screens) {
    it(`${s.target}: SAI equals Python's with equal weights, from the ~1 km dimensions only`, () => {
      const all = [...s.top, ...s.novel_leads]
      expect(all.length).toBeGreaterThan(5)
      for (const c of all) if (c.sai !== null) expect(candidateSai(c, equal)).toBeCloseTo(c.sai, 1)
    })
    it(`${s.target}: the 100 m terrain check rides along without changing the order`, () => {
      const checked = s.top.filter((c) => typeof c.terrain_100m?.score === 'number')
      expect(checked.length).toBeGreaterThan(5)
      for (let i = 1; i < s.top.length; i++) expect(s.top[i - 1]!.sai ?? -1).toBeGreaterThanOrEqual(s.top[i]!.sai ?? -1)
      const ranked = rank(s.top, equal)
      expect(ranked.filter((r) => r.t100 !== null)).toHaveLength(checked.length)
    })
  }

  it('re-ranks under a preset and keeps every candidate', () => {
    const s = screens[0]!
    const terrainOnly = rank(s.top, { T: 1 })
    expect(terrainOnly).toHaveLength(s.top.length)
    for (let i = 1; i < terrainOnly.length; i++) expect(terrainOnly[i - 1]!.sai).toBeGreaterThanOrEqual(terrainOnly[i]!.sai)
  })
})
