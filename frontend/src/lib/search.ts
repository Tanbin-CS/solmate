/**
 * Place search for the Explorer: coordinates, countries, SolMate's named regions, known analog
 * sites and about 1,250 cities and towns (Natural Earth 1:50m populated places, public domain,
 * shrunk by scripts/shrink_places.py). Everything is local; nothing is looked up online.
 */
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { asset } from './asset'
import { loadCountries, type Countries } from './countries'
import { REGIONS } from './places'

export type LatLon = { lat: number; lon: number }
export type HitKind = 'coords' | 'country' | 'region' | 'site' | 'city'
export interface Hit extends LatLon {
  kind: HitKind
  label: string
  detail: string
}

const Lat = z.number().min(-90).max(90)
const Lon = z.number().min(-180).max(180)
const PlacesSchema = z.object({
  version: z.literal(1),
  places: z.array(z.tuple([z.string().min(1).max(80), z.string().max(80), z.string().max(80), Lat, Lon, z.number().int().min(0)])).min(100),
})

export interface City extends LatLon {
  name: string
  alt: string
  country: string
  pop: number
}

export interface SearchData {
  countries: Countries
  cities: City[]
}

/** Lower case without accents, so "reykjavik" finds "Reykjavík". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** "37.05, 86.75" or "37.05 86.75" (latitude first), else null. */
export function parseCoords(q: string): LatLon | null {
  const v = q
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
  if (v.length !== 2 || !v.every(Number.isFinite)) return null
  const [lat, lon] = v as [number, number]
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
}

/** 0 = exact, 1 = a word starts with the query, 2 = contains it, null = no match. */
function quality(name: string, q: string): number | null {
  const n = fold(name)
  if (!n) return null
  if (n === q) return 0
  if (n.startsWith(q) || n.split(/[\s,()'-]+/).some((w) => w.startsWith(q))) return 1
  return n.includes(q) ? 2 : null
}

const KIND_ORDER: Record<HitKind, number> = { coords: 0, country: 1, region: 2, site: 3, city: 4 }

export interface SearchOptions {
  /** Known analog sites with readable names. */
  sites?: (LatLon & { name: string })[]
  /** Where a country should take you: SolMate's best place there for the current target, if any. */
  bestIn?: (country: string) => LatLon | null
  limit?: number
}

export function search(query: string, data: SearchData, opts: SearchOptions = {}): Hit[] {
  const limit = opts.limit ?? 8
  const c = parseCoords(query)
  if (c) return [{ kind: 'coords', label: `${c.lat}, ${c.lon}`, detail: 'Coordinates', ...c }]
  const q = fold(query)
  if (q.length < 2) return []
  const found: (Hit & { q: number; pop: number })[] = []

  for (const ct of data.countries) {
    const m = quality(ct.n, q)
    if (m === null) continue
    const best = opts.bestIn?.(ct.n) ?? null
    const city = best ? null : data.cities.find((x) => x.country === ct.n) // largest first
    const at = best ?? (city ? { lat: city.lat, lon: city.lon } : { lat: (ct.b[1] + ct.b[3]) / 2, lon: (ct.b[0] + ct.b[2]) / 2 })
    found.push({ kind: 'country', label: ct.n, detail: best ? 'Country · best analog there' : 'Country', ...at, q: m, pop: 0 })
  }
  for (const r of REGIONS) {
    const m = quality(r.name, q)
    if (m !== null) found.push({ kind: 'region', label: r.name, detail: 'Region', lat: (r.south + r.north) / 2, lon: (r.west + r.east) / 2, q: m, pop: 0 })
  }
  for (const s of opts.sites ?? []) {
    const m = quality(s.name, q)
    if (m !== null) found.push({ kind: 'site', label: s.name, detail: 'Known analog site', lat: s.lat, lon: s.lon, q: m, pop: 0 })
  }
  for (const x of data.cities) {
    const m = Math.min(quality(x.name, q) ?? 9, x.alt ? (quality(x.alt, q) ?? 9) : 9)
    if (m < 9) found.push({ kind: 'city', label: x.name, detail: x.country || 'City', lat: x.lat, lon: x.lon, q: m, pop: x.pop })
  }
  return found
    .sort((a, b) => a.q - b.q || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.pop - a.pop)
    .slice(0, limit)
    .map(({ q: _q, pop: _pop, ...h }) => h)
}

/**
 * The heading to show for a picked hit, or null to let the place panel name the spot itself.
 * Sites, regions and cities keep the name that was searched ("Death Valley", "Dhaka, Bangladesh");
 * a country jumps to its best analog, which the panel names more precisely, and coordinates have no name.
 */
export function hitTitle(h: Hit): string | null {
  if (h.kind === 'site' || h.kind === 'region') return h.label
  if (h.kind === 'city') return h.detail && h.detail !== 'City' ? `${h.label}, ${h.detail}` : h.label
  return null
}

let cities: Promise<City[]> | null = null

export function loadCities(): Promise<City[]> {
  cities ??= fetch(asset('data/places.v1.json'))
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load place names (HTTP ${res.status})`)
      return res.json()
    })
    .then((j: unknown) => PlacesSchema.parse(j).places.map(([name, alt, country, lat, lon, pop]) => ({ name, alt, country, lat, lon, pop })))
    .catch((err: unknown) => {
      cities = null
      throw err
    })
  return cities
}

/** Countries and cities, loaded the first time `active` is true (when the search box is used). */
export function useSearchData(active: boolean): SearchData | null {
  const [d, setD] = useState<SearchData | null>(null)
  useEffect(() => {
    if (!active || d) return
    let alive = true
    Promise.all([loadCountries(), loadCities()]).then(
      ([countries, cities]) => alive && setD({ countries, cities }),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [active, d])
  return d
}
