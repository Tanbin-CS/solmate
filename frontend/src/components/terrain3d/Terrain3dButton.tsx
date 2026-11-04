import { lazy, Suspense, useEffect, useState } from 'react'
import { Box, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { findPlace, loadTerrain3dIndex, type GridMeta } from '@/lib/terrain3d'

const TwinTerrain = lazy(() => import('./TwinTerrain'))

let gl: boolean | null = null
function webglAvailable(): boolean {
  if (gl !== null) return gl
  try {
    const c = document.createElement('canvas')
    gl = !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    gl = false
  }
  return gl
}

interface Props {
  lat: number
  lon: number
  placeName: string
  target: { id: string; name: string; body: 'mars' | 'moon' }
}

/** "See in 3D" for places with a baked 20 km block (the leading places of each target). */
export function Terrain3dButton({ lat, lon, placeName, target }: Props) {
  const [grids, setGrids] = useState<{
    key: string
    earth: GridMeta
    target: GridMeta
  } | null>(null)
  const [open, setOpen] = useState(false)
  const key = `${lat},${lon},${target.id}`

  useEffect(() => {
    let live = true
    loadTerrain3dIndex()
      .then((idx) => {
        const earth = findPlace(idx, lat, lon)
        const t = idx.targets[target.id]
        if (live) setGrids(earth && t ? { key, earth, target: t } : null)
      })
      .catch(() => live && setGrids(null))
    return () => {
      live = false
    }
  }, [key, lat, lon, target.id])

  if (!grids || grids.key !== key || !webglAvailable()) return null
  const body = target.body === 'moon' ? 'Moon' : 'Mars'
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Compare this place and the target side by side in 3D, same scale">
        <Box /> See in 3D
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto border-border bg-ink-900 sm:max-w-6xl">
          <div className="pr-8">
            <DialogTitle className="text-base tracking-tight">
              {placeName} beside {target.name}, in 3D
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
              Two 20 km blocks at 100 m, same scale, same sun. Drag to turn, scroll to zoom. NASA ASTER GDEM measures the top surface, so trees and buildings
              add height on Earth. For context only: this view is not part of the Analog Index.
            </DialogDescription>
          </div>
          {open && (
            <Suspense
              fallback={
                <p className="flex h-72 items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 className="size-4 animate-spin" /> Loading 3D…
                </p>
              }
            >
              <TwinTerrain
                earthLat={lat}
                earth={{
                  meta: grids.earth,
                  label: `Earth · ${placeName}`,
                  body: 'earth',
                }}
                target={{
                  meta: grids.target,
                  label: `${body} · ${target.name}`,
                  body: target.body,
                }}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
