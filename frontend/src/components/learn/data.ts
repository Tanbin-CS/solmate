import { useEffect, useState } from 'react'
import { loadModel, loadScreening, loadTargets, loadValidation } from '@/science/v2/data'
import type { Model, Target } from '@/science/v2/model'
import { rank } from '@/science/v2/screening'
import type { Validation } from '@/science/v2/validation'

export interface LearnData {
  model: Model
  targets: Target[]
  validation: Validation
}

let cache: Promise<LearnData> | null = null

/** Model, targets and validation, loaded once for the whole page. */
export function useLearnData(): LearnData | null {
  const [data, setData] = useState<LearnData | null>(null)
  useEffect(() => {
    let alive = true
    cache ??= Promise.all([loadModel(), loadTargets(), loadValidation()]).then(([model, targets, validation]) => ({ model, targets, validation }))
    cache.then(
      (d) => alive && setData(d),
      () => {
        cache = null // let a later mount retry
      },
    )
    return () => {
      alive = false
    }
  }, [])
  return data
}

/** SolMate's best place for a target: the top screened cell with equal weights (as in the Explorer). */
export async function bestFor(targetId: string, model: Model): Promise<{ lat: number; lon: number; sai: number }> {
  const s = await loadScreening(targetId)
  const top = rank(s.top, model.presets.equal!)[0]!
  return { lat: top.candidate.lat, lon: top.candidate.lon, sai: top.sai }
}

/** A target's breaks-down value (gravity, pressure, dose), or null. */
export function breaksDown(t: Target | undefined, key: string): number | null {
  const v = t?.breaks_down?.[key]?.value
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export const EARTH_G = 9.81
export const EARTH_HPA = 1013.25
