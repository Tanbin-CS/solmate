/**
 * VerdictCard data for one Earth place against one target: matches, differs, where the
 * analogy breaks down, process tags and "use it for" lines. Mirrors
 * analysis/src/solmate/compute/{verdict,breakdown,processes}.py, including the text.
 */
import { sai, type Band } from './aggregate'
import type { Model, PlaceValues, ProcessConfig, Target } from './model'
import { towardGap, type EarthStats } from './modes'
import { dimensionScore, num, planDimension, type IndicatorPlan } from './score'

export const EARTH_GRAVITY = 9.81 // m/s^2
export const EARTH_DOSE_MSV_DAY = 2.4 / 365.25 // UNSCEAR 2008 natural background, 2.4 mSv/yr
export const WEAK_DIMENSION = 0.4
export const GAP_LIMIT = 0.5
export const VEGETATION_LIMIT = 30.0

export const DIMENSION_NAMES: Readonly<Record<string, string>> = {
  T: 'Terrain',
  C: 'Climate & aridity',
  Th: 'Thermal',
  S: 'Surface & barrenness',
  M: 'Mineralogy',
  I: 'Ice & cold-trap',
  D: 'Dust & wind',
  O: 'Mission operations',
}

export const INDICATOR_LABELS: Readonly<Record<string, string>> = {
  rh2m_pct: 'Air humidity',
  aridity_index: 'Aridity (P/PET)',
  precip_mm_day: 'Precipitation',
  lst_diurnal_range_k: 'Day-night surface temperature swing',
  lst_night_min_k: 'Coldest night surface temperature',
  t2m_mean_c: 'Mean temperature',
  t2m_coldest_month_c: 'Coldest-season temperature',
  albedo_wsa_sw: 'Surface brightness (albedo)',
  barren_pct: 'Bare ground',
  forest_pct: 'Forest cover',
  snow_months_per_year: 'Months of snow/ice',
  frost_days_per_year: 'Frost days',
  dust_aod_mean: 'Atmospheric dust',
  ws10m_m_s: 'Wind speed',
  slope_median_deg: 'Typical slope',
  slope_p90_proxy_deg: 'Steepest slopes',
  elev_std_m: 'Local relief',
}

const VEGETATION_LAYERS = ['forest_pct', 'shrub_pct', 'grass_savanna_pct', 'cropland_pct', 'wetland_pct']

// --- Python-compatible number formatting -----------------------------------------------

/** Python round(x, n) for display values. */
export const pyRound = (x: number, n: number): number => Number(x.toFixed(n))

/** Python f"{x:g}": 6 significant digits, trailing zeros stripped, exponent form outside 1e-4..1e6. */
export function pyG(x: number): string {
  if (x === 0) return '0'
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'nan' : x > 0 ? 'inf' : '-inf'
  const exp = Math.floor(Math.log10(Math.abs(Number(x.toPrecision(6)))))
  if (exp < -4 || exp >= 6) {
    const [m, e] = x.toExponential(5).split('e') as [string, string]
    const mant = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m
    const ev = Number(e)
    return `${mant}e${ev < 0 ? '-' : '+'}${String(Math.abs(ev)).padStart(2, '0')}`
  }
  return String(Number(x.toPrecision(6)))
}

function ratioText(target: number, ref: number, refName = 'Earth'): string {
  const r = target / ref
  if (r >= 1) return `${r.toFixed(1)}x ${refName}`
  if (r > 1e-3) return `${r.toFixed(2)}x ${refName}`
  return `about 10^${Math.floor(Math.log10(r))} of ${refName}`
}

// --- Breaks down -----------------------------------------------------------------------

export interface Limit {
  kind: 'always' | 'earth_can_only_approach' | 'vegetation' | 'differs' | 'not_assessed'
  id: string
  text: string
  earth?: number
  target?: number
  unit?: string
  gap?: number
  score?: number
}

function breaksValue(target: Target, key: string): number | null {
  const v = target.breaks_down?.[key]?.value
  return typeof v === 'number' ? v : null
}

export function environmentLimits(target: Target, earthPressureHpa: number): Limit[] {
  const out: Limit[] = []
  const g = breaksValue(target, 'gravity_m_s2')
  if (g !== null)
    out.push({
      kind: 'always', id: 'gravity', earth: EARTH_GRAVITY, target: g, unit: 'm/s^2',
      text: `Gravity is ${ratioText(g, EARTH_GRAVITY)}: Earth tests overload structures, wheels and people.`,
    })
  const p = breaksValue(target, 'surface_pressure_hpa')
  if (p !== null && Number.isFinite(earthPressureHpa))
    out.push({
      kind: 'always', id: 'pressure', earth: pyRound(earthPressureHpa, 1), target: p, unit: 'hPa',
      text:
        `Surface pressure is ${ratioText(p, earthPressureHpa, 'this place')}: no Earth site ` +
        'reproduces vacuum or the thin Martian air (heat transfer, dust lofting, boiling).',
    })
  const d = breaksValue(target, 'radiation_dose_msv_day')
  if (d !== null)
    out.push({
      kind: 'always', id: 'radiation', earth: pyRound(EARTH_DOSE_MSV_DAY, 4), target: d, unit: 'mSv/day',
      text:
        `Surface radiation dose is ${ratioText(d, EARTH_DOSE_MSV_DAY)}: Earth's atmosphere and ` +
        'magnetic field shield every analog site.',
    })
  return out
}

export function dimensionLimits(dimScores: Readonly<Record<string, number>>, applicable: readonly string[]): Limit[] {
  const out: Limit[] = []
  for (const k of applicable) {
    const s = dimScores[k]
    const name = DIMENSION_NAMES[k] ?? k
    if (s === undefined || !Number.isFinite(s)) out.push({ kind: 'not_assessed', id: k, text: `${name}: no data for this place or target.` })
    else if (s < WEAK_DIMENSION) out.push({ kind: 'differs', id: k, score: pyRound(s, 3), text: `${name} differs (score ${s.toFixed(2)}).` })
  }
  return out
}

export function towardGaps(values: PlaceValues, plans: readonly IndicatorPlan[], stats: Readonly<Record<string, EarthStats>>): Limit[] {
  const out: Limit[] = []
  for (const p of plans) {
    if (p.mode.kind !== 'toward' || p.target === null) continue
    const x = num(values, p.name)
    if (!Number.isFinite(x)) continue
    const gap = towardGap(x, p.target, stats[p.name]!)
    if (gap > GAP_LIMIT)
      out.push({
        kind: 'earth_can_only_approach', id: p.name, earth: pyRound(x, 3), target: p.target, gap: pyRound(gap, 3),
        text:
          `${INDICATOR_LABELS[p.name] ?? p.name}: the target value (${pyG(p.target)}) lies beyond ` +
          `every place on Earth; this place gets ${((1 - gap) * 100).toFixed(0)}% of the way from ` +
          "Earth's typical value.",
      })
  }
  return out
}

export function vegetationFlag(values: PlaceValues): Limit[] {
  // Python: values.get(k, 0.0) or 0.0 -> a missing layer counts 0, a NaN layer makes the sum NaN.
  const veg = VEGETATION_LAYERS.reduce((a, k) => a + (values[k] === undefined ? 0 : num(values, k)), 0)
  if (!(veg > VEGETATION_LIMIT)) return []
  return [
    {
      kind: 'vegetation', id: 'vegetation', earth: pyRound(veg, 1), unit: '%',
      text:
        `${veg.toFixed(0)}% vegetation cover: biology and soils have no lunar or Martian counterpart, and ` +
        'canopy inflates surface-model terrain.',
    },
  ]
}

// --- Processes and uses ----------------------------------------------------------------

type Rule = ProcessConfig['uses'][number]['when']

function conditionHolds(value: number, cond: Readonly<Record<string, number>>, es: EarthStats | undefined): boolean {
  if (!Number.isFinite(value)) return false
  for (const [op, ref] of Object.entries(cond)) {
    if (op === 'gte' && !(value >= ref)) return false
    if (op === 'lt' && !(value < ref)) return false
    if (op === 'gte_earth_quantile' && (es === undefined || !(value >= es.quantiles[Math.trunc(ref)]!))) return false
  }
  return true
}

const ruleFires = (when: Rule, values: PlaceValues, stats: Readonly<Record<string, EarthStats>>): boolean =>
  Object.entries(when).every(([k, c]) => conditionHolds(num(values, k), c, stats[k]))

export interface ProcessTag {
  id: string
  name: string
  analog: string
  evidence: Record<string, number>
}

export function tagsFor(values: PlaceValues, body: Target['body'], config: ProcessConfig, stats: Readonly<Record<string, EarthStats>>): ProcessTag[] {
  return Object.entries(config.tags)
    .filter(([, t]) => t.bodies.includes(body) && ruleFires(t.when, values, stats))
    .map(([id, t]) => ({
      id, name: t.name, analog: t.analog,
      evidence: Object.fromEntries(Object.keys(t.when).map((k) => [k, pyRound(num(values, k), 3)])),
    }))
}

export function usesFor(values: PlaceValues, config: ProcessConfig, stats: Readonly<Record<string, EarthStats>>): { id: string; text: string }[] {
  return config.uses.filter((u) => ruleFires(u.when, values, stats)).map((u) => ({ id: u.id, text: u.text }))
}

// --- The verdict -----------------------------------------------------------------------

export interface Verdict {
  target: string
  sai: number | null
  coverage: number
  insufficient: boolean
  dimensions: { id: string; name: string; score: number | null; band: Band; contribution: number }[]
  matches: { id: string; text: string }[]
  differs: Limit[]
  breaks_down: Limit[]
  process_tags: ProcessTag[]
  use_it_for: { id: string; text: string }[]
}

/** Default weights: equal over the target's dimensions, mission operations off. */
export function defaultWeights(model: Pick<Model, 'dimensions'>): Record<string, number> {
  return Object.fromEntries(Object.keys(model.dimensions).filter((k) => k !== 'O').map((k) => [k, 1.0]))
}

export function explain(
  values: PlaceValues,
  target: Target,
  model: Pick<Model, 'dimensions' | 'earth_stats' | 'processes'>,
  weights: Readonly<Record<string, number>> = defaultWeights(model),
): Verdict {
  const stats = model.earth_stats
  const applicable = Object.entries(model.dimensions)
    .filter(([k, d]) => d.applies_to.includes(target.body) && (weights[k] ?? 0) > 0)
    .map(([k]) => k)
  const dimScores: Record<string, number> = {}
  const allPlans: IndicatorPlan[] = []
  for (const k of applicable) {
    const plans = planDimension(model.dimensions[k]!, target.indicators, stats)
    allPlans.push(...plans)
    dimScores[k] = dimensionScore(values, plans, stats).score
  }
  const result = sai(dimScores, Object.fromEntries(applicable.map((k) => [k, weights[k]!])))
  const strong = result.dimensions.filter((d) => d.band === 'strong').sort((a, b) => b.score - a.score)
  return {
    target: target.id,
    sai: Number.isFinite(result.sai) ? pyRound(result.sai, 2) : null,
    coverage: pyRound(result.coverage, 3),
    insufficient: result.insufficient,
    dimensions: result.dimensions.map((d) => ({
      id: d.id,
      name: DIMENSION_NAMES[d.id] ?? d.id,
      score: Number.isFinite(d.score) ? pyRound(d.score, 4) : null,
      band: d.band,
      contribution: pyRound(d.contribution, 4),
    })),
    matches: strong.map((d) => ({ id: d.id, text: `${DIMENSION_NAMES[d.id] ?? d.id} matches (score ${d.score.toFixed(2)}).` })),
    differs: dimensionLimits(dimScores, applicable),
    breaks_down: [
      ...environmentLimits(target, num(values, 'surface_pressure_hpa')),
      ...towardGaps(values, allPlans, stats),
      ...vegetationFlag(values),
    ],
    process_tags: tagsFor(values, target.body, model.processes, stats),
    use_it_for: usesFor(values, model.processes, stats),
  }
}
