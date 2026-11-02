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
