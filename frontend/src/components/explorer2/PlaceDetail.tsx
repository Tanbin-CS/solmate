import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { Loader2, Mountain, X } from 'lucide-react'
import type { TerrainResult } from '@/api/client'
import { Terrain3dButton } from '@/components/terrain3d/Terrain3dButton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Async } from '@/hooks/useV2'
import type { Model, Target } from '@/science/v2/model'
import type { PlaceResult } from '@/science/v2/place'
import { useCountries } from '@/lib/countries'
import { placeLabel } from '@/lib/places'
import { BAND_STYLE } from './labels'
import { DimensionBars } from './DimensionBars'
import { ExtraData } from './ExtraData'
import { PlaceImages } from './PlaceImages'
import { VerdictCard } from './VerdictCard'

interface Props {
  state: Async<PlaceResult>
  target: Target
  model: Model
  isBox: boolean
  /** Name the user searched for ("Death Valley"); otherwise the region and country under the point. */
  title?: string
  terrain: { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: TerrainResult }
  /** 100 m terrain check already measured for this screening cell (stage 2), if any */
  stored100?: Terrain100 | null
  onRefine: () => void
  onClose: () => void
  onTarget: (id: string) => void
}

export function PlaceDetail({ state, target, model, isBox, title, terrain, stored100, onRefine, onClose, onTarget }: Props) {
  const r = state.status === 'ready' ? state.data : null
  const countries = useCountries()
  const auto = r ? placeLabel(r.centre.lat, r.centre.lon, countries) : null
  const place = auto && title ? { ...auto, name: title } : auto
  const live = terrain.status === 'done' && terrain.result.ok ? { score: terrain.result.data.terrain_score, indicators: terrain.result.data.indicators } : null
  const check = live ?? (!isBox && stored100 && stored100.score !== null && Number.isFinite(stored100.score) ? stored100 : null)
  // The Analog Index stays on the validated ~1 km terrain; the 100 m score is shown beside it as a check.
  const verdict = r?.verdict ?? null
  const shown = verdict?.sai ?? null
  const band = shown === null ? 'n/a' : shown >= 75 ? 'strong' : shown >= 40 ? 'partial' : 'weak'

  return (
    <article className="flex h-full flex-col" aria-labelledby="place-title" aria-busy={state.status === 'loading'}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="label-mono">{isBox ? 'Drawn area' : 'Selected place'} · vs {target.name}</p>
          <h2 id="place-title" className={place && place.name !== place.coords ? 'mt-1.5 text-lg font-semibold tracking-tight' : 'mt-1.5 font-mono text-lg tracking-tight'}>
            {place ? place.name : 'Scoring…'}
          </h2>
          {r && place && (
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {place.name !== place.coords && `${place.coords} · `}
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
                  {BAND_STYLE[band].label} analog
                  {verdict.insufficient && <span className="text-negative"> · low data coverage ({Math.round(verdict.coverage * 100)}%)</span>}
                </p>
              </div>
            </div>
            <DimensionBars verdict={verdict} model={model} />
            <TerrainCheck check={check} terrain={terrain} targetName={target.name} onRefine={onRefine}>
              {!isBox && place && <Terrain3dButton lat={r.centre.lat} lon={r.centre.lon} placeName={place.name} target={target} />}
            </TerrainCheck>
            <PlaceImages lat={r.centre.lat} lon={r.centre.lon} targetId={target.id} />
            <VerdictCard verdict={verdict} />
            <ExtraData layers={model.context_layers} values={r.values} />
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
            <p className="font-mono text-[11px] leading-relaxed text-slate-400">Scored in your browser from NASA data.</p>
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

type Terrain100 = { score: number | null; indicators: Record<string, number | null> }

/** The 100 m terrain score as its own check: measured on request, never folded into the Analog Index. */
function TerrainCheck({
  check,
  terrain,
  targetName,
  onRefine,
  children,
}: {
  check: Terrain100 | null
  terrain: Props['terrain']
  targetName: string
  onRefine: () => void
  children?: ReactNode
}) {
  const score = check?.score ?? null
  const pct = score === null ? null : Math.round(score * 100)
  const band = pct === null ? 'n/a' : pct >= 75 ? 'strong' : pct >= 40 ? 'partial' : 'weak'
  const deg = (k: string) => {
    const v = check?.indicators[k]
    return v === null || v === undefined ? '–' : `${v.toFixed(1)}°`
  }
  return (
    <section aria-labelledby="terrain-check" className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="terrain-check" className="text-[12px] font-medium text-slate-200">
            100 m terrain check
          </h3>
          {pct !== null && (
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              median slope {deg('slope_median')} · steepest 10% {deg('slope_p90')}
            </p>
          )}
        </div>
        {pct !== null ? (
          <p className="shrink-0 text-right font-mono text-sm tabular text-slate-100">
            {pct} <span className={`text-[11px] ${BAND_STYLE[band].className}`}>{BAND_STYLE[band].label}</span>
          </p>
        ) : (
          <TerrainButton terrain={terrain} onRefine={onRefine} />
        )}
      </div>
      {terrain.status === 'done' && !terrain.result.ok && <p className="mt-2 text-[12px] text-slate-400">{terrain.result.message}</p>}
      {terrain.status === 'done' && terrain.result.ok && terrain.result.data.partial && (
        <p className="mt-2 text-[12px] text-slate-400">NASA terrain arrived only in part; showing what was measured.</p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        {pct === null ? `Measure slope at 100 m from NASA ASTER GDEM and compare it with ${targetName}. ` : `Slope at 100 m from NASA ASTER GDEM, compared with ${targetName}. `}
        Not part of the Analog Index: on its own it did not pick out known analog sites in our test.{' '}
        <Link to="/method#terrain-check" className="text-slate-300 underline underline-offset-2 hover:text-slate-100">
          Why
        </Link>
      </p>
      {children && <div className="mt-2.5">{children}</div>}
    </section>
  )
}
