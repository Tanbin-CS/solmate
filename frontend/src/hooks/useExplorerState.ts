import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

export type Layer = 'imagery' | 'terrain'

/**
 * Explorer state lives in the URL so any view (selected site, weights, map layer) can be shared or bookmarked.
 *   ?site=lava-beds&w=1,1,0.5,1,1&layer=terrain
 */
export function useExplorerState(indicatorIds: readonly string[]) {
  const [params, setParams] = useSearchParams()

  const weights = useMemo(() => {
    const raw = params.get('w')?.split(',').map(Number) ?? []
    return Object.fromEntries(
      indicatorIds.map((id, i) => {
        const v = raw[i]
        return [id, Number.isFinite(v) && v! >= 0 && v! <= 1 ? v! : 1]
      }),
    ) as Record<string, number>
  }, [params, indicatorIds])

  const selected = params.get('site')
  const layer: Layer = params.get('layer') === 'terrain' ? 'terrain' : 'imagery'

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

  const setWeight = useCallback(
    (id: string, value: number) => {
      const w = indicatorIds.map((k) => (k === id ? value : weights[k]!))
      update({ w: w.every((x) => x === 1) ? null : w.map((x) => +x.toFixed(2)).join(',') })
    },
    [indicatorIds, weights, update],
  )

  return {
    weights,
    selected,
    layer,
    isDefaultWeights: indicatorIds.every((k) => weights[k] === 1),
    select: (id: string | null) => update({ site: id }),
    setLayer: (l: Layer) => update({ layer: l === 'imagery' ? null : l }),
    setWeight,
    resetWeights: () => update({ w: null }),
  }
}
