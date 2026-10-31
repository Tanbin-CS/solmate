import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

export type Preset = 'equal' | 'expert' | 'mission_ops' | 'learned'
export type ListTab = 'top' | 'novel' | 'leaders'
export type Layer2 = 'imagery' | 'terrain'
export interface LatLon {
  lat: number
  lon: number
}
export interface BoxSel {
  south: number
  west: number
  north: number
  east: number
}

export const DEFAULT_TARGET = 'jezero_crater'
const PRESETS: readonly Preset[] = ['equal', 'expert', 'mission_ops', 'learned']
const DIMS = ['T', 'C', 'Th', 'S', 'M', 'I', 'D', 'O']

const finite = (xs: number[]) => xs.every(Number.isFinite)
const r4 = (x: number) => +x.toFixed(4)

function parsePlace(raw: string | null): LatLon | null {
  const v = raw?.split(',').map(Number) ?? []
  return v.length === 2 && finite(v) && Math.abs(v[0]!) <= 90 && Math.abs(v[1]!) <= 180 ? { lat: v[0]!, lon: v[1]! } : null
}

function parseBox(raw: string | null): BoxSel | null {
  const v = raw?.split(',').map(Number) ?? []
  if (v.length !== 4 || !finite(v)) return null
  const [south, west, north, east] = v as [number, number, number, number]
  return south < north && west < east && south >= -90 && north <= 90 ? { south, west, north, east } : null
}

/**
 * Explorer v2 state lives in the URL so any view can be shared:
 *   /explorer?t=haworth&w=learned&p=36.45,84.45&tab=novel
 */
export function useExplorer2State() {
  const [params, setParams] = useSearchParams()
  const target = /^[a-z0-9_]{1,40}$/.test(params.get('t') ?? '') ? params.get('t')! : DEFAULT_TARGET
  const preset: Preset = PRESETS.includes(params.get('w') as Preset) ? (params.get('w') as Preset) : 'equal'
  const tab: ListTab = params.get('tab') === 'novel' ? 'novel' : params.get('tab') === 'leaders' ? 'leaders' : 'top'
  const leaderDim = DIMS.includes(params.get('dim') ?? '') ? params.get('dim')! : 'T'
  const layer: Layer2 = params.get('layer') === 'terrain' ? 'terrain' : 'imagery'
  const place = useMemo(() => parsePlace(params.get('p')), [params])
  const box = useMemo(() => parseBox(params.get('box')), [params])

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  return {
    target,
    preset,
    tab,
    leaderDim,
    layer,
    place,
    box,
    setTarget: (t: string) => update({ t: t === DEFAULT_TARGET ? null : t }),
    setPreset: (p: Preset) => update({ w: p === 'equal' ? null : p }),
    setTab: (t: ListTab) => update({ tab: t === 'top' ? null : t }),
    setLeaderDim: (d: string) => update({ dim: d === 'T' ? null : d }),
    setLayer: (l: Layer2) => update({ layer: l === 'imagery' ? null : l }),
    pick: (p: LatLon | null) => update({ p: p ? `${r4(p.lat)},${r4(p.lon)}` : null, box: null }),
    pickBox: (b: BoxSel) =>
      update({ box: [b.south, b.west, b.north, b.east].map(r4).join(','), p: `${r4((b.south + b.north) / 2)},${r4((b.west + b.east) / 2)}` }),
    clear: () => update({ p: null, box: null }),
  }
}
