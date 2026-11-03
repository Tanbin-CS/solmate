import { useEffect, useState } from 'react'
import { loadModel, loadScreening, loadTargets, loadValidation } from '@/science/v2/data'
import type { Model, Target } from '@/science/v2/model'
import { rank, type Ranked, type Screening } from '@/science/v2/screening'
import type { TargetValidation, Validation } from '@/science/v2/validation'

/** The two targets the landing page tells its story with; the Explorer covers all eleven. */
export const FLAGSHIPS = [
  { id: 'jezero_crater', short: 'Jezero Crater', quicklooks: 'jezero' },
  { id: 'mons_mouton_plateau', short: 'Mons Mouton Plateau', quicklooks: 'mons-mouton-plateau' },
] as const

export interface Flagship {
  target: Target
  short: string
  screening: Screening
  /** top cells ranked by SAI with equal weights */
  top: Ranked[]
  validation: TargetValidation
  quicklooks: { hillshade: string; imagery: string }
}

export interface HomeData {
  model: Model
  targets: Target[]
  validation: Validation
  flagships: Flagship[]
  equal: Record<string, number>
}

async function load(): Promise<HomeData> {
  const [model, targets, validation] = await Promise.all([loadModel(), loadTargets(), loadValidation()])
  const equal = model.presets.equal!
  const flagships = await Promise.all(
    FLAGSHIPS.map(async (f) => {
      const target = targets.find((t) => t.id === f.id)
      const v = validation.targets[f.id]
      if (!target || !v) throw new Error(`missing data for ${f.id}`)
      const screening = await loadScreening(f.id)
      return {
        target,
        short: f.short,
        screening,
        top: rank(screening.top, equal),
        validation: v,
        quicklooks: { hillshade: `data/quicklooks/${f.quicklooks}-hillshade.webp`, imagery: `data/quicklooks/${f.quicklooks}-imagery.webp` },
      }
    }),
  )
  return { model, targets, validation, flagships, equal }
}

/** Everything the landing page shows, from the same v2 files the Explorer scores with. */
export function useHomeData() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: HomeData }>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    load().then(
      (data) => alive && setState({ status: 'ready', data }),
      (error: unknown) => alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** Explorer deep link for a place against a target. */
export const explorerLink = (targetId: string, lat?: number, lon?: number, extra: Record<string, string> = {}) =>
  `/explorer?${new URLSearchParams({ ...(targetId !== 'jezero_crater' && { t: targetId }), ...(lat !== undefined && lon !== undefined && { p: `${lat},${lon}` }), ...extra })}`
