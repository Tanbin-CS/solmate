/**
 * Country names for any point on Earth, offline. The polygons are Natural Earth 1:110m Admin 0
 * countries (public domain), shrunk by scripts/shrink_countries.py to names and rounded rings.
 * Loaded once on demand (about 55 KB gzipped); no network lookup per place.
 */
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { asset } from './asset'

const Ring = z.array(z.number().finite()).refine((r) => r.length >= 6 && r.length % 2 === 0, 'ring needs 3+ lon/lat pairs')
const CountriesSchema = z.object({
  version: z.literal(1),
  countries: z
    .array(
      z.object({
        n: z.string().min(1).max(60),
        b: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        p: z.array(z.array(Ring).min(1)).min(1),
      }),
    )
    .min(100),
})

export type Countries = z.infer<typeof CountriesSchema>['countries']

/** Even-odd test over all rings of one polygon, so holes work. Rings are flat [lon, lat, lon, lat, ...]. */
function inside(rings: number[][], lon: number, lat: number): boolean {
  let hit = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i]!
      const yi = r[i + 1]!
      const xj = r[j]!
      const yj = r[j + 1]!
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
    }
  }
  return hit
}

/** Coast cells can fall just outside the coarse 1:110m outlines; accept a country within this many degrees. */
const NEAR_DEG = 1

/**
 * Islands too small for the 1:110m outlines that screened cells land on, and too far from the
 * mainland for the nearest-coast fallback (which would name the wrong country).
 */
const ISLANDS: { country: string; south: number; north: number; west: number; east: number }[] = [
  { country: 'Spain', south: 27.5, north: 29.5, west: -18.3, east: -13.3 }, // Canary Islands
  { country: 'Indonesia', south: 0.3, north: 3, west: 95.8, east: 98 }, // Nias and Simeulue
]

/** The country a point is in, or the nearest one within about 100 km, else null (open sea). */
export function countryAt(countries: Countries, lat: number, lon: number): string | null {
  for (const c of countries) {
    const [w, s, e, n] = c.b
    if (lon < w || lon > e || lat < s || lat > n) continue
    if (c.p.some((poly) => inside(poly, lon, lat))) return c.n
  }
  const island = ISLANDS.find((i) => lat >= i.south && lat < i.north && lon >= i.west && lon < i.east)
  if (island) return island.country
  const k = Math.cos((lat * Math.PI) / 180)
  let best: string | null = null
  let bestD = NEAR_DEG * NEAR_DEG
  for (const c of countries) {
    const [w, s, e, n] = c.b
    if (lon < w - NEAR_DEG / Math.max(k, 0.1) || lon > e + NEAR_DEG / Math.max(k, 0.1) || lat < s - NEAR_DEG || lat > n + NEAR_DEG) continue
    for (const poly of c.p)
      for (const r of poly)
        for (let i = 0; i < r.length; i += 2) {
          const d = ((r[i]! - lon) * k) ** 2 + (r[i + 1]! - lat) ** 2
          if (d < bestD) {
            bestD = d
            best = c.n
          }
        }
  }
  return best ?? (lat < -60 ? 'Antarctica' : null)
}

let cache: Promise<Countries> | null = null

export function loadCountries(): Promise<Countries> {
  cache ??= fetch(asset('data/countries.v1.json'))
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load country outlines (HTTP ${res.status})`)
      return res.json()
    })
    .then((j: unknown) => CountriesSchema.parse(j).countries)
    .catch((err: unknown) => {
      cache = null // let a later call retry
      throw err
    })
  return cache
}

/** Country outlines, or null while loading (or if they failed: names then fall back to coordinates). */
export function useCountries(): Countries | null {
  const [c, setC] = useState<Countries | null>(null)
  useEffect(() => {
    let alive = true
    loadCountries().then(
      (x) => alive && setC(x),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])
  return c
}
