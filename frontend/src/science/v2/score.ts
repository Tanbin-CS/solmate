/**
 * Indicators -> dimension score for one target. Mirrors analysis/src/solmate/compute/score.py
 * (single place instead of arrays). Pure functions only.
 */
import { weightedMean } from './aggregate'
import type { Dimension, PlaceValues } from './model'
import { chooseMode, ecdf, similarity, type EarthStats, type Mode } from './modes'

/** Mineral classes map to the ASTER Ninomiya index that rises with that mineral. */
export const MINERAL_INDEX: Readonly<Record<string, string>> = {
  mafic: 'mafic_index',
  carbonate: 'carbonate_index',
  quartz_rich: 'quartz_index',
}

export interface IndicatorPlan {
  name: string
  weight: number
  target: number | null // null for direction-only indicators (minerals, operations)
  mode: Mode
}

/** Read a place value; null and undefined become NaN. */
export function num(values: PlaceValues, key: string): number {
  const v = values[key]
  return v === null || v === undefined ? Number.NaN : v
}

function targetValue(entry: unknown): number | null {
  if (entry === null || typeof entry !== 'object' || !('value' in entry)) return null
  const v = (entry as { value: unknown }).value
  return typeof v === 'number' ? v : null
}

export function planDimension(
  dim: Dimension,
  targetIndicators: Readonly<Record<string, unknown>>,
  stats: Readonly<Record<string, EarthStats>>,
): IndicatorPlan[] {
  const plans: IndicatorPlan[] = []
  const mineral = (targetIndicators.mineral_class ?? {}) as Record<string, unknown>
  const mineralIndices = Object.values(MINERAL_INDEX)
  for (const [name, spec] of Object.entries(dim.indicators)) {
    const w = spec.weight ?? 1.0
    const es = stats[name]
    if (!es) throw new Error(`no Earth statistics for ${name}`)
    if (spec.direction === 'lower_is_better') {
      plans.push({ name, weight: w, target: null, mode: { kind: 'toward', direction: -1 } })
    } else if (mineralIndices.includes(name)) {
      const cls = Object.keys(MINERAL_INDEX).find((k) => MINERAL_INDEX[k] === name)!
      if (cls in mineral) plans.push({ name, weight: w, target: null, mode: { kind: 'toward', direction: mineral[cls] ? 1 : -1 } })
    } else {
      const value = targetValue(targetIndicators[name])
      if (value === null) continue // computed later (100 m terrain) or not applicable
      plans.push({ name, weight: w, target: value, mode: chooseMode(value, es) })
    }
  }
  return plans
}

export function indicatorSimilarity(x: number, plan: IndicatorPlan, es: EarthStats): number {
  if (!Number.isFinite(x)) return Number.NaN
  if (plan.target === null) {
    const p = ecdf(x, es)
    return plan.mode.direction > 0 ? p : 1 - p
  }
  return similarity(x, plan.target, es, plan.mode)
}

/** Weighted mean similarity of a dimension's indicators (NaN without plans or data) and the share of weight with data. */
export function dimensionScore(
  values: PlaceValues,
  plans: readonly IndicatorPlan[],
  stats: Readonly<Record<string, EarthStats>>,
): { score: number; share: number } {
  if (plans.length === 0) return { score: Number.NaN, share: 0 }
  const sims = plans.map((p) => indicatorSimilarity(num(values, p.name), p, stats[p.name]!))
  const { mean, share } = weightedMean(
    sims,
    plans.map((p) => p.weight),
  )
  return { score: mean, share }
}
