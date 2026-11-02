import { describe, expect, it } from 'vitest'
import validationJson from '../../../public/data/v2/validation.json'
import targetsJson from '../../../public/data/v2/targets.json'
import { ValidationSchema } from './validation'

describe('validation.json', () => {
  it('parses and covers every target', () => {
    const v = ValidationSchema.parse(validationJson)
    const ids = (targetsJson as { targets: { id: string }[] }).targets.map((t) => t.id)
    expect(Object.keys(v.targets).sort()).toEqual([...ids].sort())
    for (const t of Object.values(v.targets)) {
      expect(t.auc_ci95[0]).toBeLessThanOrEqual(t.auc_equal)
      expect(t.auc_equal).toBeLessThanOrEqual(t.auc_ci95[1])
      expect(Object.keys(t.positives)).toHaveLength(t.n_positives)
    }
  })
})

describe('regional validation addendum', () => {
  it('is exported, reproduces the original AUCs and states the pre-registered decision', () => {
    const v = ValidationSchema.parse(validationJson)
    const a = v.addendum_1!
    expect(a.region_km).toBe(500)
    for (const [id, t] of Object.entries(a.targets)) {
      expect(t.equal.auc).toBeCloseTo(v.targets[id]!.auc_equal, 3)
      expect(t.lunar_ops !== undefined).toBe(t.body === 'moon')
    }
    expect(a.summary.moon.decision).toMatch(/keep equal|adopt Lunar ops/)
  })
})
