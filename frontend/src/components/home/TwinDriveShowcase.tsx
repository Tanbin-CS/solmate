/**
 * Home page Twin Drive: the flagship target's best Earth place and the target itself as two
 * 20 km NASA terrain blocks, with the same rover driving both. three.js loads only when the
 * section comes near the screen, and the tour stops when it leaves.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Box, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { twinGrids, useTerrain3dIndex, webglAvailable } from '@/components/terrain3d/useTwin3d'
import type { Flagship } from '@/hooks/useHomeData'
import { useCountries } from '@/lib/countries'
import { placeLabel } from '@/lib/places'
import { GRAVITY, ROVER, wheelLoadN } from '@/lib/rover'

const TwinTerrain = lazy(() => import('@/components/terrain3d/TwinTerrain'))

/** Watches an element: near = has come within the margin once; visible = on screen now. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [state, setState] = useState({ near: false, visible: false })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setState({ near: true, visible: true })
      return
    }
    const io = new IntersectionObserver(([e]) => setState((s) => ({ near: s.near || !!e?.isIntersecting, visible: !!e?.isIntersecting })), {
      rootMargin: '300px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, state] as const
}

export function TwinDriveShowcase({ flagship }: { flagship: Flagship }) {
  const idx = useTerrain3dIndex()
  const countries = useCountries()
  const [ref, view] = useInView<HTMLDivElement>()
  const best = flagship.top[0]?.candidate
  const grids = best ? twinGrids(idx, best.lat, best.lon, flagship.target.id) : null
  const body = flagship.target.body
  const place = best ? placeLabel(best.lat, best.lon, countries) : null
  const link = best ? `/explorer?${new URLSearchParams({ t: flagship.target.id, p: `${best.lat},${best.lon}`, view: '3d' })}` : '/explorer'
  const gl = typeof document !== 'undefined' && webglAvailable()

  return (
    <div ref={ref} className="space-y-4">
      {!gl ? (
        <p className="rounded-lg border border-border p-6 text-sm text-slate-400">This browser has no WebGL, so the 3D drive cannot run here.</p>
      ) : grids && place && view.near ? (
        <Suspense
          fallback={
            <p className="flex h-72 items-center justify-center gap-2 rounded-lg border border-border text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" /> Loading 3D…
            </p>
          }
        >
          <TwinTerrain
            compact
            paused={!view.visible}
            earthLat={best!.lat}
            earth={{ meta: grids.earth, label: `Earth · ${place.name}`, body: 'earth' }}
            target={{ meta: grids.target, label: `${body === 'moon' ? 'Moon' : 'Mars'} · ${flagship.short}`, body }}
          />
        </Suspense>
      ) : (
        <div className="h-72 animate-pulse rounded-lg border border-border bg-ink-900" aria-hidden />
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl font-mono text-[12px] leading-relaxed text-slate-400">
          Same {ROVER.massKg.toLocaleString('en')} kg NASA rover on both: {Math.round(wheelLoadN('earth')).toLocaleString('en')} N per wheel on flat ground on
          Earth, {Math.round(wheelLoadN(body)).toLocaleString('en')} N on {body === 'moon' ? 'the Moon' : 'Mars'} (g {GRAVITY[body]} m/s²). The ring turns amber
          past NASA’s {ROVER.driveLimitDeg}° driving limit. Terrain: NASA ASTER GDEM and {body === 'moon' ? 'LRO LOLA' : 'the Mars 2020 CTX DTM'}, 100 m.
        </p>
        <Button asChild variant="outline" className="shrink-0">
          <Link to={link}>
            <Box /> Open the full Twin Drive
          </Link>
        </Button>
      </div>
    </div>
  )
}
