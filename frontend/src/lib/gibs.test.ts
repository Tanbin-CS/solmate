import { describe, expect, it } from 'vitest'
import { gibsTiles, worldviewUrl } from './gibs'

/** Tiles must cover the whole window: every corner and the centre fall inside some tile. */
function covers(tiles: ReturnType<typeof gibsTiles>) {
  return [0.01, 50, 99.99].every((x) => [0.01, 50, 99.99].every((y) => tiles.some((t) => x >= t.left && x <= t.left + t.size && y >= t.top && y <= t.top + t.size)))
}

describe('GIBS tile windows', () => {
  it('stitches pre-cut WMTS tiles, never the slow WMS renderer', () => {
    const tiles = gibsTiles({ lat: 36.46, lon: -116.87, km: 20, kind: 'imagery' })
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThanOrEqual(9)
    for (const t of tiles) expect(t.url).toMatch(/^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/Landsat_WELD_.+\/1990-12-01\/GoogleMapsCompatible_Level12\/\d+\/\d+\/\d+\.jpg$/)
    expect(covers(tiles)).toBe(true)
  })
  it('picks enough detail for the size drawn', () => {
    const z = (px: number) => Number(gibsTiles({ lat: 0, lon: 0, km: 20, kind: 'relief', px })[0]!.url.split('/').at(-3))
    expect(z(96)).toBeLessThan(z(512))
    expect(z(4096)).toBe(12)
  })
  it('covers the window near the poles and across the date line', () => {
    expect(covers(gibsTiles({ lat: 75.4, lon: -89.8, km: 40, kind: 'relief' }))).toBe(true)
    const dateLine = gibsTiles({ lat: -16, lon: 179.99, km: 20, kind: 'imagery' })
    expect(covers(dateLine)).toBe(true)
    expect(dateLine.some((t) => t.url.endsWith('/0.jpg'))).toBe(true)
  })
})

describe('Worldview link', () => {
  it('opens a box of the given width centred on the place', () => {
    const u = new URL(worldviewUrl(0, 10, 20))
    expect(u.origin).toBe('https://worldview.earthdata.nasa.gov')
    const [w, s, e, n] = u.searchParams.get('v')!.split(',').map(Number) as [number, number, number, number]
    expect((w + e) / 2).toBeCloseTo(10, 3)
    expect((s + n) / 2).toBeCloseTo(0, 3)
    expect((e - w) * 111.32).toBeCloseTo(20, 0)
  })
  it('stays inside valid latitudes near the poles', () => {
    const [, s, , n] = new URL(worldviewUrl(89.99, 0, 40)).searchParams.get('v')!.split(',').map(Number)
    expect(n).toBeLessThanOrEqual(90)
    expect(s).toBeGreaterThan(-90)
  })
})
