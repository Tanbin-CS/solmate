import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import raw from '../../public/data/countries.v1.json'
import { countryAt, type Countries } from './countries'
import { placeLabel } from './places'

const countries = (raw as { countries: Countries }).countries

describe('country names', () => {
  it('names well-known places', () => {
    expect(countryAt(countries, 37.05, 86.75)).toBe('China')
    expect(countryAt(countries, -24.083, -70.017)).toBe('Chile')
    expect(countryAt(countries, 36.46, -116.87)).toBe('United States of America')
    expect(countryAt(countries, 75.383, -89.683)).toBe('Canada')
    expect(countryAt(countries, 23.8, 90.4)).toBe('Bangladesh')
    expect(countryAt(countries, 19.4, -155.3)).toBe('United States of America')
    expect(countryAt(countries, 28.05, -15.65)).toBe('Spain')
    expect(countryAt(countries, -80.35, -66.75)).toBe('Antarctica')
  })

  it('accepts coast cells just outside the coarse outline, but not the open sea', () => {
    expect(countryAt(countries, 9.05, 50.55)).toBe('Somalia')
    expect(countryAt(countries, 0, -140)).toBeNull()
  })

  it('combines region and country, and falls back to coordinates', () => {
    expect(placeLabel(37.05, 86.75, countries).name).toBe('Tibetan Plateau, China')
    expect(placeLabel(20.45, 31.25, countries).name).toBe('Sudan')
    expect(placeLabel(20.45, 31.25).name).toBe(placeLabel(20.45, 31.25).coords)
  })

  it('gives every screened place a name', () => {
    const dir = join(__dirname, '../../public/data/v2/screening')
    const missing: string[] = []
    for (const f of readdirSync(dir)) {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as { top: { lat: number; lon: number }[]; novel_leads: { lat: number; lon: number }[]; dimension_leaders: Record<string, { lat: number; lon: number }[]> }
      for (const c of [...s.top, ...s.novel_leads, ...Object.values(s.dimension_leaders).flat()]) if (!countryAt(countries, c.lat, c.lon)) missing.push(`${c.lat},${c.lon}`)
    }
    expect(missing).toEqual([])
  })
})
