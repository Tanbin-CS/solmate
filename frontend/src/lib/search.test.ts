import { describe, expect, it } from 'vitest'
import countriesRaw from '../../public/data/countries.v1.json'
import placesRaw from '../../public/data/places.v1.json'
import type { Countries } from './countries'
import { fold, hitTitle, parseCoords, search, type City, type SearchData } from './search'

const data: SearchData = {
  countries: (countriesRaw as { countries: Countries }).countries,
  cities: (placesRaw as { places: [string, string, string, number, number, number][] }).places.map(([name, alt, country, lat, lon, pop]): City => ({ name, alt, country, lat, lon, pop })),
}
const sites = [{ name: 'Death Valley', lat: 36.46, lon: -116.87 }]

describe('place search', () => {
  it('reads coordinates, latitude first', () => {
    expect(parseCoords('37.05, 86.75')).toEqual({ lat: 37.05, lon: 86.75 })
    expect(parseCoords('-24.1 -70')).toEqual({ lat: -24.1, lon: -70 })
    expect(parseCoords('95, 10')).toBeNull()
    expect(parseCoords('Dhaka')).toBeNull()
    expect(search('23.8, 90.4', data)[0]).toMatchObject({ kind: 'coords', lat: 23.8, lon: 90.4 })
  })

  it('finds cities, ignoring case and accents', () => {
    expect(search('dhaka', data)[0]).toMatchObject({ kind: 'city', label: 'Dhaka', detail: 'Bangladesh' })
    expect(search('Leh', data).some((h) => h.label === 'Leh')).toBe(true)
    expect(fold('Reykjavík')).toBe('reykjavik')
  })

  it('puts a country before its cities and sends it to the best analog when known', () => {
    const plain = search('Chile', data)[0]!
    expect(plain).toMatchObject({ kind: 'country', label: 'Chile', detail: 'Country' })
    const best = search('Chile', data, { bestIn: (c) => (c === 'Chile' ? { lat: -22.5, lon: -68.3 } : null) })[0]!
    expect(best).toMatchObject({ lat: -22.5, lon: -68.3, detail: 'Country · best analog there' })
  })

  it('finds regions and known analog sites', () => {
    expect(search('tibet', data)[0]).toMatchObject({ kind: 'region', label: 'Tibetan Plateau' })
    expect(search('death', data, { sites })[0]).toMatchObject({ kind: 'site', label: 'Death Valley' })
  })

  it('needs two letters and caps the list', () => {
    expect(search('a', data)).toEqual([])
    expect(search('an', data).length).toBeLessThanOrEqual(8)
  })
  it('keeps the searched name as the place heading', () => {
    expect(hitTitle(search('death valley', data, { sites })[0]!)).toBe('Death Valley')
    expect(hitTitle(search('Dhaka', data)[0]!)).toBe('Dhaka, Bangladesh')
    expect(hitTitle(search('Chile', data)[0]!)).toBeNull()
    expect(hitTitle(search('23.8, 90.4', data)[0]!)).toBeNull()
  })
})
