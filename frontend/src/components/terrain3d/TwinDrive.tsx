/**
 * Twin Drive: the 3D view of a place beside its target, offered as a card near the top of the
 * place panel. The card previews both 20 km blocks as height profiles along the drive line and
 * opens the full 3D rover drive. Context only: nothing here feeds the Analog Index.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Box, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { loadGrid, type Grid } from '@/lib/terrain3d'
import { twinGrids, useTerrain3dIndex, webglAvailable, type TwinGrids } from './useTwin3d'

const TwinTerrain = lazy(() => import('./TwinTerrain'))

export const TWIN_DRIVE = 'Twin Drive'
const COLOR = { earth: '#7fd8e6', moon: '#c9d3de', mars: '#d9785a' } as const

interface Target {
  id: string
  name: string
  body: 'mars' | 'moon'
}

interface Props {
  lat: number
  lon: number
  placeName: string
  target: Target
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Heights along the middle row, relative to the lowest point, in metres. */
function middleRow(g: Grid): number[] {
  const r = Math.floor(g.n / 2)
  const row = Array.from(g.z.subarray(r * g.n, (r + 1) * g.n))
  const lo = Math.min(...row.filter(Number.isFinite))
  return row.map((v) => v - lo)
}

/** Both blocks' height along the drive line at the same vertical scale. */
function Preview({ grids, body }: { grids: TwinGrids; body: Target['body'] }) {
  const [rows, setRows] = useState<{ key: string; a: number[]; b: number[] } | null>(null)
  const key = grids.earth.file + grids.target.file
  useEffect(() => {
    let live = true
    Promise.all([loadGrid(grids.earth), loadGrid(grids.target)]).then(
      ([a, b]) => live && setRows({ key, a: middleRow(a), b: middleRow(b) }),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [grids, key])
  const W = 300
  const H = 52
  if (!rows || rows.key !== key) return <div className="h-[52px] animate-pulse rounded bg-ink-800" aria-hidden />
  const top = Math.max(1, ...rows.a.filter(Number.isFinite), ...rows.b.filter(Number.isFinite))
  const path = (hs: number[]) =>
    hs
      .map((h, i) =>
        Number.isFinite(h)
          ? `${i === 0 || !Number.isFinite(hs[i - 1]!) ? 'M' : 'L'}${((i / (hs.length - 1)) * W).toFixed(1)},${(H - 2 - (h / top) * (H - 6)).toFixed(1)}`
          : '',
      )
      .join('')
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-[52px] w-full"
      role="img"
      aria-label="Height along the drive line, Earth and target at the same scale"
    >
      <path d={path(rows.a)} fill="none" stroke={COLOR.earth} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={path(rows.b)} fill="none" stroke={COLOR[body]} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** The Twin Drive card for the place panel, or a short note when this place has no 3D block. */
export function TwinDriveCard({ lat, lon, placeName, target, open, onOpenChange }: Props) {
  const idx = useTerrain3dIndex()
  const grids = twinGrids(idx, lat, lon, target.id)
  if (!idx || !webglAvailable()) return null
  if (!grids) {
    return (
      <p className="flex gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-400">
        <Box className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {idx.targets[target.id]
          ? `${TWIN_DRIVE} 3D covers the 25 top analogs and 25 novel leads of each target. Pick a place marked with the cube in the list to drive it.`
          : `${target.name} has no 100 m NASA terrain model, so it has no ${TWIN_DRIVE} 3D view.`}
      </p>
    )
  }
  const body = target.body === 'moon' ? 'Moon' : 'Mars'
  return (
    <section aria-labelledby="twin-drive" className="rounded-lg border border-data/40 bg-data/[0.06] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="twin-drive" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
          <Box className="size-4 text-data" aria-hidden /> {TWIN_DRIVE} · 3D
        </h3>
        <span className="font-mono text-[10.5px] text-slate-400">20 km · 100 m NASA terrain</span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
        Drive the same NASA rover over this place and {target.name}, side by side at the same scale. Tilt and shadow come from the NASA terrain under it; the
        weight per wheel shows the gravity difference.
      </p>
      <div className="mt-2">
        <Preview grids={grids} body={target.body} />
        <p className="mt-0.5 flex justify-between font-mono text-[10px] text-slate-500">
          <span style={{ color: COLOR.earth }}>Earth</span>
          <span>height along the drive line, same scale</span>
          <span style={{ color: COLOR[target.body] }}>{body}</span>
        </p>
      </div>
      <Button size="sm" className="mt-2.5 w-full" onClick={() => onOpenChange(true)}>
        <Box /> Drive it in 3D
      </Button>
      <TwinDriveDialog open={open} onOpenChange={onOpenChange} grids={grids} lat={lat} placeName={placeName} target={target} />
    </section>
  )
}

/** The full 3D rover drive in a dialog. */
export function TwinDriveDialog({
  open,
  onOpenChange,
  grids,
  lat,
  placeName,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  grids: TwinGrids
  lat: number
  placeName: string
  target: Target
}) {
  const body = target.body === 'moon' ? 'Moon' : 'Mars'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto border-border bg-ink-900 sm:max-w-6xl">
        <div className="pr-8">
          <DialogTitle className="text-base tracking-tight">
            {TWIN_DRIVE}: {placeName} beside {target.name}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
            Two 20 km blocks at 100 m, same scale, same sun. Drag to turn, scroll to zoom. NASA ASTER GDEM measures the top surface, so trees and buildings add
            height on Earth. For context only: this view is not part of the Analog Index.
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
              earth={{ meta: grids.earth, label: `Earth · ${placeName}`, body: 'earth' }}
              target={{ meta: grids.target, label: `${body} · ${target.name}`, body: target.body }}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}
