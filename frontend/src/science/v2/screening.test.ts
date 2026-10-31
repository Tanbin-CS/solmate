import { describe, expect, it } from 'vitest'
import jezeroJson from '../../../public/data/v2/screening/jezero_crater.json'
import moutonJson from '../../../public/data/v2/screening/mons_mouton_plateau.json'
import { candidateSai, rank, ScreeningSchema } from './screening'

const screens = [ScreeningSchema.parse(jezeroJson), ScreeningSchema.parse(moutonJson)]
const equal = { T: 1, C: 1, Th: 1, S: 1, M: 1, I: 1, D: 1, O: 0 }

describe('screening arithmetic matches pipeline/rescore.py', () => {
  for (const s of screens) {
    it(`${s.target}: refined SAI equals Python sai_refined with equal weights`, () => {
      const refined = [...s.top, ...s.novel_leads].filter((c) => typeof c.sai_refined === 'number')
      expect(refined.length).toBeGreaterThan(5)
      for (const c of refined) expect(candidateSai(c, equal)).toBeCloseTo(c.sai_refined!, 1)
    })
  }

  it('re-ranks under a preset and keeps every candidate', () => {
    const s = screens[0]!
    const terrainOnly = rank(s.top, { T: 1 })
    expect(terrainOnly).toHaveLength(s.top.length)
    for (let i = 1; i < terrainOnly.length; i++) expect(terrainOnly[i - 1]!.sai).toBeGreaterThanOrEqual(terrainOnly[i]!.sai)
  })
})
