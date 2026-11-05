import { useCallback, useEffect, useState } from 'react'
import { findPlace, loadTerrain3dIndex, type GridMeta, type Terrain3dIndex } from '@/lib/terrain3d'

export interface TwinGrids {
  earth: GridMeta
  target: GridMeta
}

/** The 3D block index (null until it loads), whether loading failed, and a retry. */
export function useTerrain3dIndexState(): { idx: Terrain3dIndex | null; failed: boolean; retry: () => void } {
  const [state, setState] = useState<{ idx: Terrain3dIndex | null; failed: boolean }>({ idx: null, failed: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    // a failed load is not cached by loadTerrain3dIndex, so a retry fetches again
    loadTerrain3dIndex().then(
      (idx) => live && setState({ idx, failed: false }),
      () => live && setState({ idx: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [attempt])
  const retry = useCallback(() => {
    setState({ idx: null, failed: false })
    setAttempt((a) => a + 1)
  }, [])
  return { ...state, retry }
}

/** The 3D block index, or null until it loads (or when it fails: the 3D view is optional). */
export function useTerrain3dIndex(): Terrain3dIndex | null {
  return useTerrain3dIndexState().idx
}

/** Both blocks for a place and target, when the place is one of the baked leading places. */
export function twinGrids(idx: Terrain3dIndex | null, lat: number, lon: number, targetId: string): TwinGrids | null {
  if (!idx) return null
  const earth = findPlace(idx, lat, lon)
  const target = idx.targets[targetId]
  return earth && target ? { earth, target } : null
}

let gl: boolean | null = null
/** WebGL check, done once: without it the 3D view is not offered. */
export function webglAvailable(): boolean {
  if (gl !== null) return gl
  try {
    const c = document.createElement('canvas')
    gl = !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    gl = false
  }
  return gl
}
