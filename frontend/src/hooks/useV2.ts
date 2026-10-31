import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTerrain, warmUp, type TerrainResult } from '@/api/client'
import { loadModel, loadScreening, loadTargets } from '@/science/v2/data'
import type { Model, Target } from '@/science/v2/model'
import type { PlaceResult } from '@/science/v2/place'
import type { Screening } from '@/science/v2/screening'
import { score } from '@/science/v2/scorer'
import type { BoxSel, LatLon } from './useExplorer2State'

export type Async<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T }

function useAsync<T>(load: () => Promise<T>, key: string): Async<T> & { retry: () => void } {
  const [state, setState] = useState<Async<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' })) // keep old data visible while the next loads
    load().then(
      (data) => alive && setState({ status: 'ready', data }),
      (error: unknown) => alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  return { ...state, retry }
}

export function useModel() {
  return useAsync<{ model: Model; targets: Target[] }>(async () => {
    const [model, targets] = await Promise.all([loadModel(), loadTargets()])
    return { model, targets }
  }, 'model')
}

export function useScreening(targetId: string) {
  return useAsync<Screening>(() => loadScreening(targetId), targetId)
}

/** Dimension weights for a preset; "learned" resolves to the target body's cross-validated weights. */
export function presetWeights(model: Model, preset: string, body: Target['body']): Record<string, number> {
  const key = preset === 'learned' ? `learned_${body}` : preset
  return model.presets[key] ?? model.presets.equal!
}

/** Coarse score of a place or box from the browser worker; re-runs when inputs change. */
export function usePlaceScore(place: LatLon | null, box: BoxSel | null, targetId: string, weights: Record<string, number> | null) {
  const key = place && weights ? JSON.stringify([place, box, targetId, weights]) : ''
  const [state, setState] = useState<{ key: string; value: Async<PlaceResult> } | null>(null)
  useEffect(() => {
    if (!key) return
    let alive = true
    const query = box ? { kind: 'box' as const, ...box, targetId, weights: weights! } : { kind: 'point' as const, ...place!, targetId, weights: weights! }
    score(query).then(
      (data) => alive && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) => alive && setState({ key, value: { status: 'error', error: error instanceof Error ? error : new Error('scoring failed') } }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!key) return null
  return state?.key === key ? state.value : ({ status: 'loading' } as const)
}

/** 100 m ASTER GDEM terrain from the API, on request. Resets when the place or target changes. */
export function useTerrain100(place: LatLon | null, box: BoxSel | null, targetId: string) {
  type T = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: TerrainResult }
  const key = JSON.stringify([place, box, targetId])
  const [stored, setStored] = useState<{ key: string; value: T }>({ key, value: { status: 'idle' } })
  const ctrl = useRef<AbortController | null>(null)
  useEffect(() => () => ctrl.current?.abort(), [key])
  const state: T = stored.key === key ? stored.value : { status: 'idle' }
  useEffect(() => warmUp(), [])
  const run = useCallback(() => {
    if (!place) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setStored({ key, value: { status: 'loading' } })
    // a drawn box sets the window size (10-40 km); a click uses the standard 20 km window
    const sizeKm = box ? Math.min(40, Math.max(10, Math.max(box.north - box.south, (box.east - box.west) * Math.cos((place.lat * Math.PI) / 180)) * 111.32)) : 20
    fetchTerrain({ targetId, lat: place.lat, lon: place.lon, sizeKm }, c.signal).then(
      (result) => !c.signal.aborted && setStored({ key, value: { status: 'done', result } }),
      () => undefined, // aborted by a newer request
    )
  }, [place, box, targetId, key])
  return { state, run }
}
