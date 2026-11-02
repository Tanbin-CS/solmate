import { describe, expect, it } from 'vitest'
import report from '../../public/data/v2/report.json'

describe('report.json', () => {
  it('has the sections the challenge asks for', () => {
    const heads = report.blocks.filter((b) => b.type === 'h2').map((b) => (b as { text: string }).text)
    expect(heads).toEqual(expect.arrayContaining(['Headline findings', 'Best places for every target', 'How far to trust it', 'Limits']))
    expect(heads.filter((h) => h.startsWith('Case study'))).toHaveLength(2)
  })

  it('links only to https URLs', () => {
    const text = JSON.stringify(report)
    expect(text).not.toMatch(/http:\/\//)
    expect(text).not.toMatch(/javascript:/i)
  })
})
