import { Loader2, Mountain, X } from 'lucide-react'
import type { TerrainResult } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Async } from '@/hooks/useV2'
import type { Model, Target } from '@/science/v2/model'
import type { PlaceResult } from '@/science/v2/place'
import { withRefinedTerrain } from '@/science/v2/verdict'
import { fmtCoord } from '@/lib/format'
import { BAND_STYLE } from './labels'
import { DimensionBars } from './DimensionBars'
import { VerdictCard } from './VerdictCard'

interface Props {
  state: Async<PlaceResult>
  target: Target
  model: Model
  weights: Record<string, number>
  isBox: boolean
  terrain: { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: TerrainResult }
  /** 100 m terrain score already measured for this screening cell (stage 2), if any */
  storedT100?: number | null
  onRefine: () => void
  onClose: () => void
  onTarget: (id: string) => void
}

export function PlaceDetail({ state, target, model, weights, isBox, terrain, storedT100, onRefine, onClose, onTarget }: Props) {
  const r = state.status === 'ready' ? state.data : null
  const live = terrain.status === 'done' && terrain.result.ok ? terrain.result.data.terrain_score : null
  const t100 = live ?? (!isBox && storedT100 !== undefined && storedT100 !== null && Number.isFinite(storedT100) ? storedT100 : null)
  const coarse = r?.verdict ?? null
  const refined = coarse !== null && t100 !== null
  const verdict = coarse && t100 !== null ? withRefinedTerrain(coarse, t100, weights) : coarse
  const shown = verdict?.sai ?? null
  const band = shown === null ? 'n/a' : shown >= 75 ? 'strong' : shown >= 40 ? 'partial' : 'weak'

  return (
    <article className="flex h-full flex-col" aria-labelledby="place-title" aria-busy={state.status === 'loading'}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="label-mono">{isBox ? 'Drawn area' : 'Selected place'} · vs {target.name}</p>
          <h2 id="place-title" className="mt-1.5 font-mono text-lg tracking-tight">
            {r ? fmtCoord(r.centre.lat, r.centre.lon) : 'Scoring…'}
          </h2>
          {r && (
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {r.land ? `${r.cells} NASA stack cell${r.cells === 1 ? '' : 's'} at 0.1°` : 'Ocean or no land data'}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-ink-700 hover:text-slate-100" aria-label="Close place details">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {state.status === 'error' && <p role="alert" className="text-sm text-negative">{state.error.message}</p>}
        {state.status === 'loading' && !r && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-40 bg-ink-700" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full bg-ink-800" />
            ))}
          </div>
        )}
        {r && !r.land && <p className="text-sm text-slate-300">No land here in the NASA stack. Pick a place on land between 83° N and 83° S for the full score.</p>}
        {r && verdict && (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="label-mono">SolMate Analog Index</p>
                <p className="mt-1 font-mono text-5xl font-medium tabular tracking-tight text-slate-100">
                  {shown === null ? '–' : shown.toFixed(1)}
                  <span className="text-lg text-slate-400">/100</span>
                </p>
                <p className={`mt-1 font-mono text-[11px] ${BAND_STYLE[band].className}`}>
                  {BAND_STYLE[band].label} analog{refined && <span className="text-slate-400"> · with 100 m terrain</span>}
                  {verdict.insufficient && <span className="text-negative"> · low data coverage ({Math.round(verdict.coverage * 100)}%)</span>}
                </p>
              </div>
              {t100 === null && <TerrainButton terrain={terrain} onRefine={onRefine} />}
            </div>
            {terrain.status === 'done' && !terrain.result.ok && <p className="text-[12px] text-slate-400">{terrain.result.message}</p>}
            {terrain.status === 'done' && terrain.result.ok && terrain.result.data.partial && (
              <p className="text-[12px] text-slate-400">NASA terrain arrived only in part; showing what was measured.</p>
            )}
            <DimensionBars verdict={verdict} model={model} refined={refined} />
            <VerdictCard verdict={verdict} />
            <section>
              <h3 className="label-mono mb-1.5">Best targets for this place</h3>
              <ol className="space-y-0.5">
                {r.ranking.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => onTarget(x.id)}
                      className="flex w-full items-baseline justify-between rounded px-1.5 py-1 text-left text-[12.5px] text-slate-300 hover:bg-ink-800 hover:text-slate-100"
                    >
                      <span>{x.name}</span>
                      <span className="font-mono text-[11px] tabular">{x.sai === null ? '–' : x.sai.toFixed(1)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <p className="font-mono text-[10.5px] leading-relaxed text-slate-400">model {r.model_version} · scored in your browser from NASA data</p>
          </>
        )}
      </div>
    </article>
  )
}

function TerrainButton({ terrain, onRefine }: { terrain: Props['terrain']; onRefine: () => void }) {
  if (terrain.status === 'loading')
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="animate-spin" /> NASA terrain…
      </Button>
    )
  if (terrain.status === 'done' && terrain.result.ok) return null
  return (
    <Button size="sm" variant="outline" onClick={onRefine} title="Measure slope and relief at 100 m from NASA ASTER GDEM v3">
      <Mountain /> 100 m terrain
    </Button>
  )
}
