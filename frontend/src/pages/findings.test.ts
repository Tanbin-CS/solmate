import { describe, expect, it } from 'vitest'
import report from '../../public/data/v2/report.json'
import { ownSitePath } from '@/lib/links'

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

describe('ownSitePath', () => {
  it('keeps only exact-origin links in the app', () => {
    expect(ownSitePath('https://solmate-analog.web.app/explorer?p=1,2')).toBe('/explorer?p=1,2')
    expect(ownSitePath('https://solmate-analog.web.app')).toBe('/')
    expect(ownSitePath('https://solmate-analog.web.app.evil.example/x')).toBeNull()
    expect(ownSitePath('https://evil.example/https://solmate-analog.web.app')).toBeNull()
    expect(ownSitePath('not a url')).toBeNull()
  })
})
