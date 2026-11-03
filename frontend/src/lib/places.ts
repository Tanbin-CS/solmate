import { countryAt, type Countries } from './countries'
import { fmtCoord } from './format'

/**
 * Broad region names for the screening's best cells, which come from a 0.1 degree grid and
 * have no gazetteer name. Each box was checked against the cells it labels (all are high,
 * barren deserts: surface pressure 530-650 hPa on the plateaus, 900+ hPa in the basins).
 * Anything outside the boxes is shown by its coordinates only.
 */
export const REGIONS: { name: string; south: number; north: number; west: number; east: number }[] = [
  { name: 'Tibetan Plateau', south: 30, north: 38.1, west: 75, east: 95 },
  { name: 'Tarim Basin', south: 38.1, north: 42, west: 75, east: 95 },
  { name: 'Puna de Atacama', south: -30, north: -21, west: -71, east: -65 },
  { name: 'Sistan Basin', south: 29, north: 35, west: 57, east: 64 },
]

export function regionOf(lat: number, lon: number): string | null {
  return REGIONS.find((r) => lat >= r.south && lat < r.north && lon >= r.west && lon < r.east)?.name ?? null
}

/**
 * A readable name and the coordinates. With country outlines loaded the name is "Region, Country"
 * or just the country ("Tibetan Plateau, China", "Somalia"); without them it is the region name,
 * or the coordinates when the place has no region.
 */
export function placeLabel(lat: number, lon: number, countries?: Countries | null): { name: string; coords: string } {
  const coords = fmtCoord(lat, lon)
  const region = regionOf(lat, lon)
  const country = countries ? countryAt(countries, lat, lon) : null
  const name = region && country ? `${region}, ${country}` : (region ?? country ?? coords)
  return { name, coords }
}
