/**
 * Compare up to three pinned places against the current target: a tray on the map and a table
 * with one column per place. Every score is computed in the browser by the same scorer as the
 * place panel, so the table and the panel always agree.
 */
import { useState } from 'react'
import { Box, Columns3, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { LatLon } from '@/hooks/useExplorer2State'
import { MAX_PINS } from '@/hooks/useExplorer2State'
import { usePlaceScore } from '@/hooks/useV2'
import type { Target } from '@/science/v2/model'
import { useCountries } from '@/lib/countries'
import { placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import { BAND_STYLE } from './labels'

interface Props {
  pins: LatLon[]
  target: Target
  weights: Record<string, number> | null
  /** stored 100 m terrain check (0..1) and nearest known site for a place, when it is a screening cell */
  facts: (p: LatLon) => { t100: number | null; nearest: string | null } | null
  has3d: (p: LatLon) => boolean
  onShow: (p: LatLon) => void
  onRemove: (p: LatLon) => void
  onClear: () => void
}

const band = (v: number | null) => (v === null ? 'n/a' : v >= 0.75 ? 'strong' : v >= 0.4 ? 'partial' : 'weak')

/** Floating tray over the map plus the comparison table it opens. */
export function ComparePlaces({ pins, target, weights, facts, has3d, onShow, onRemove, onClear }: Props) {
  const [open, setOpen] = useState(false)
  if (pins.length === 0) return null
  return (
    <>
      <div className="surface pointer-events-auto flex items-center gap-2 rounded-full py-1 pl-3 pr-1 shadow-lg" role="region" aria-label="Places to compare">
        <Columns3 className="size-4 text-data" aria-hidden />
        <span className="text-[12.5px] text-slate-200">
          {pins.length} of {MAX_PINS} places pinned
        </span>
        <Button size="sm" className="h-7 rounded-full" onClick={() => setOpen(true)}>
          Compare
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
          aria-label="Clear the comparison"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-ink-900 sm:max-w-4xl">
          <DialogTitle className="text-base tracking-tight">Compare places for {target.name}</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed text-slate-400">
            Same target, same weights, scored in your browser from NASA data. The best value in each row is marked.
          </DialogDescription>
          <CompareTable
            pins={pins}
            target={target}
            weights={weights}
            facts={facts}
            has3d={has3d}
            onShow={(p) => {
              setOpen(false)
              onShow(p)
            }}
            onRemove={onRemove}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function CompareTable({ pins, target, weights, facts, has3d, onShow, onRemove }: Omit<Props, 'onClear'>) {
  const countries = useCountries()
  // one hook per slot (fixed count), so adding or removing a pin keeps the hook order
  const s0 = usePlaceScore(pins[0] ?? null, null, target.id, weights)
  const s1 = usePlaceScore(pins[1] ?? null, null, target.id, weights)
  const s2 = usePlaceScore(pins[2] ?? null, null, target.id, weights)
  const cols = pins.map((p, i) => {
    const st = [s0, s1, s2][i]
    const v = st?.status === 'ready' ? st.data.verdict : null
    return { p, label: placeLabel(p.lat, p.lon, countries), v, loading: st?.status === 'loading', failed: st?.status === 'error', f: facts(p) }
  })
  const dims = cols.find((c) => c.v)?.v?.dimensions ?? []
  const grid = { gridTemplateColumns: `minmax(8rem, 1fr) repeat(${cols.length}, minmax(0, 1fr))` }

  return (
    <div role="table" aria-label={`Pinned places compared for ${target.name}`} className="mt-2">
      <div className="grid gap-3 pb-2" style={grid} role="row">
        <span role="columnheader" className="label-mono self-end">
          Place
        </span>
        {cols.map((c) => (
          <div key={`${c.p.lat},${c.p.lon}`} role="columnheader" className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-100" title={c.label.name}>
              {c.label.name}
            </p>
            <p className="truncate font-mono text-[10.5px] text-slate-400">{c.label.coords}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onShow(c.p)}
                className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-slate-300 hover:text-slate-100"
              >
                <MapPin className="size-3" aria-hidden /> Show
              </button>
              <button
                type="button"
                onClick={() => onRemove(c.p)}
                className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-slate-100"
              >
                <X className="size-3" aria-hidden /> Remove
              </button>
            </div>
            {c.loading && <p className="mt-1 text-[11px] text-slate-400">Scoring…</p>}
            {c.failed && <p className="mt-1 text-[11px] text-negative">Could not load; try again later.</p>}
          </div>
        ))}
      </div>
      <Row grid={grid} name="SolMate Analog Index" values={cols.map((c) => c.v?.sai ?? null)} fmt={(v) => v.toFixed(1)} />
      {dims.map((d) => (
        <Row
          grid={grid}
          key={d.id}
          name={d.name}
          values={cols.map((c) => c.v?.dimensions.find((x) => x.id === d.id)?.score ?? null)}
          fmt={(v) => String(Math.round(v * 100))}
          scale
        />
      ))}
      <Row grid={grid} name="100 m terrain check" values={cols.map((c) => c.f?.t100 ?? null)} fmt={(v) => String(Math.round(v * 100))} />
      <div className="grid items-center gap-3 border-t border-border py-2" style={grid} role="row">
        <span className="text-[12.5px] text-slate-300" role="rowheader">
          Nearest known analog
        </span>
        {cols.map((c, i) => (
          <span key={i} role="cell" className="text-[12px] text-slate-300">
            {c.f?.nearest ?? '–'}
          </span>
        ))}
      </div>
      <div className="grid items-center gap-3 border-t border-border py-2" style={grid} role="row">
        <span className="text-[12.5px] text-slate-300" role="rowheader">
          Twin Drive 3D
        </span>
        {cols.map((c, i) => (
          <span key={i} role="cell" className="text-[12px]">
            {has3d(c.p) ? (
              <span className="inline-flex items-center gap-1 text-data">
                <Box className="size-3" aria-hidden /> available
              </span>
            ) : (
              <span className="text-slate-500">not baked</span>
            )}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        The 100 m terrain check is not part of the Analog Index. Bands: strong <span className={BAND_STYLE.strong.className}>75+</span>, partial{' '}
        <span className={BAND_STYLE.partial.className}>40–75</span>, weak <span className={BAND_STYLE.weak.className}>under 40</span>.
      </p>
    </div>
  )
}

/** The highest value in a row, when at least two places have one. */
function best(xs: (number | null)[]): number | null {
  const ok = xs.filter((x): x is number => x !== null && Number.isFinite(x))
  return ok.length > 1 ? Math.max(...ok) : null
}

function Row({
  name,
  values,
  fmt,
  scale,
  grid,
}: {
  name: string
  values: (number | null)[]
  fmt: (v: number) => string
  scale?: boolean
  grid: React.CSSProperties
}) {
  const top = best(values)
  return (
    <div className="grid items-center gap-3 border-t border-border py-2" style={grid} role="row">
      <span className="text-[12.5px] text-slate-300" role="rowheader">
        {name}
      </span>
      {values.map((v, i) => (
        <span key={i} role="cell" className="min-w-0">
          <span className={cn('font-mono text-[13px] tabular', v !== null && v === top ? 'font-semibold text-slate-100' : 'text-slate-300')}>
            {v === null || !Number.isFinite(v) ? '–' : fmt(v)}
            {v !== null && v === top && <span className="ml-1 text-[10px] text-positive">best</span>}
          </span>
          {scale && v !== null && (
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ink-600" aria-hidden>
              <span className={cn('block h-full rounded-full', BAND_BG[band(v)])} style={{ width: `${v * 100}%` }} />
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

const BAND_BG: Record<string, string> = { strong: 'bg-data', partial: 'bg-derived', weak: 'bg-negative/80', 'n/a': 'bg-ink-500' }
