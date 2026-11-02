import { describe, expect, it } from 'vitest'
import provenanceJson from '../../../public/data/v2/provenance.json'
import { ProvenanceSchema, safeUrl } from './provenance'

describe('provenance.json', () => {
  it('parses, with every dataset section and all 41 stack layers', () => {
    const p = ProvenanceSchema.parse(provenanceJson)
    expect(p.layers).toHaveLength(41)
    expect(new Set(p.datasets.map((d) => d.section)).size).toBeGreaterThanOrEqual(5)
    expect(p.raw.files).toBe(p.raw.products.reduce((a, x) => a + x.files, 0))
  })

  it('links only http(s) URLs', () => {
    expect(safeUrl('https://doi.org/10.1/x')).toBe('https://doi.org/10.1/x')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
  })
})
