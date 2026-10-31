import { describe, expect, it } from 'vitest'
import golden from '../golden/explain.v2.json'
import modelJson from '../../../public/data/v2/model.json'
import targetsJson from '../../../public/data/v2/targets.json'
import { ModelSchema, TargetsSchema } from './model'
import { explain, pyG } from './verdict'

const model = ModelSchema.parse(modelJson)
const targets = new Map(TargetsSchema.parse(targetsJson).targets.map((t) => [t.id, t]))

describe('v2 verdict matches Python explain() on real places', () => {
  it('covers every target and every verdict branch', () => {
    expect(new Set(golden.cases.map((c) => c.target)).size).toBe(targets.size)
    const kinds = new Set(golden.cases.flatMap((c) => [...c.expected.breaks_down, ...c.expected.differs].map((b) => b.kind)))
    expect([...kinds].sort()).toEqual(['always', 'differs', 'earth_can_only_approach', 'not_assessed', 'vegetation'])
    const tags = new Set(golden.cases.flatMap((c) => c.expected.process_tags.map((t) => t.id)))
    expect([...tags].sort()).toEqual(['aeolian_dust', 'periglacial', 'rugged_highland', 'volcanic_mafic'])
  })

  for (const c of golden.cases) {
    it(`${c.place} vs ${c.target} (${c.preset ?? 'default'})`, () => {
      const weights = c.preset ? model.presets[c.preset] : undefined
      const got = explain(c.values, targets.get(c.target)!, model, weights)
      expect(JSON.parse(JSON.stringify(got))).toEqual(c.expected)
    })
  }
})

describe('pyG formats like Python f"{x:g}"', () => {
  it.each([
    [0, '0'], [90, '90'], [0.5, '0.5'], [203.1, '203.1'], [1e-5, '1e-05'], [1234567, '1.23457e+06'],
    [-40.25, '-40.25'], [0.0001, '0.0001'], [123456.7, '123457'],
  ])('%s -> %s', (x, want) => expect(pyG(x)).toBe(want))
})
