import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ListOrdered } from 'lucide-react'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { CandidateList } from '@/components/explorer2/CandidateList'
import { DIM_ORDER } from '@/components/explorer2/labels'
import { MapToolbar } from '@/components/explorer2/MapToolbar'
import { MapView2, type MapCandidate } from '@/components/explorer2/MapView2'
import { PlaceDetail } from '@/components/explorer2/PlaceDetail'
import { PresetPicker } from '@/components/explorer2/PresetPicker'
import { TargetPicker } from '@/components/explorer2/TargetPicker'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useExplorer2State, type ListTab } from '@/hooks/useExplorer2State'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { presetWeights, useModel, usePlaceScore, useScreening, useTerrain100 } from '@/hooks/useV2'
import type { Model, Target } from '@/science/v2/model'
import { rank } from '@/science/v2/screening'
import { DIMENSION_NAMES } from '@/science/v2/verdict'
import { cn } from '@/lib/utils'

const EASE = [0.16, 1, 0.3, 1] as const

export default function ExplorerPage() {
  const data = useModel()
  if (data.status === 'error') return <ErrorState title="The SolMate model could not be loaded." detail={data.error.message} onRetry={data.retry} />
  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-clip bg-ink-950">
      {data.status === 'loading' ? (
        <div className="surface absolute left-4 top-4 w-[360px] rounded-xl">
          <PanelSkeleton />
        </div>
      ) : (
        <Explorer model={data.data.model} targets={data.data.targets} />
      )}
    </div>
  )
}

function Explorer({ model, targets }: { model: Model; targets: Target[] }) {
  const reduced = useReducedMotion() ?? false
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const ui = useExplorer2State()
  const target = targets.find((t) => t.id === ui.target) ?? targets[0]!
  const weights = presetWeights(model, ui.preset, target.body)
  const screening = useScreening(target.id)
  const scr = screening.status === 'ready' ? screening.data : null
  const place = usePlaceScore(ui.place, ui.box, target.id, weights)
  const terrain = useTerrain100(ui.place, ui.box, target.id)
  const [drawing, setDrawing] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  const lists = useMemo(() => {
    if (!scr) return null
    return {
      top: rank(scr.top, weights),
      novel: rank(scr.novel_leads, weights),
      leaders: Object.fromEntries(Object.entries(scr.dimension_leaders).map(([k, v]) => [k, rank(v, weights)])),
    }
  }, [scr, weights])

  const shown = useMemo(
    () => (lists ? (ui.tab === 'top' ? lists.top : ui.tab === 'novel' ? lists.novel : (lists.leaders[ui.leaderDim] ?? lists.leaders.T ?? [])) : []),
    [lists, ui.tab, ui.leaderDim],
  )
  const mapCandidates: MapCandidate[] = useMemo(
    () => shown.map((r) => ({ lat: r.candidate.lat, lon: r.candidate.lon, sai: r.sai, novel: (r.candidate.nearest_known_km ?? 0) > (scr?.novelty_km ?? 300) })),
    [shown, scr],
  )
  // screening cells carry their stage-2 (100 m) terrain score; reuse it instead of calling the API
  const storedT100 = useMemo(() => {
    if (!scr || !ui.place) return null
    const all = [...scr.top, ...scr.novel_leads, ...Object.values(scr.dimension_leaders).flat()]
    const hit = all.find((c) => Math.abs(c.lat - ui.place!.lat) < 0.05 && Math.abs(c.lon - ui.place!.lon) < 0.05)
    return hit?.terrain_100m?.score ?? null
  }, [scr, ui.place])
  const leaderDims = DIM_ORDER.filter((d) => lists?.leaders[d]?.length)

  const pick = (lat: number, lon: number) => {
    ui.pick({ lat, lon })
    setListOpen(false)
  }

  const panel = (
    <div className={cn('flex h-full flex-col transition-opacity', screening.status === 'loading' && 'opacity-60')}>
      <div className="space-y-4 border-b border-border p-4">
        <TargetPicker targets={targets} value={target.id} onChange={ui.setTarget} />
        <PresetPicker value={ui.preset} onChange={ui.setPreset} />
        <Link to="/method#validation" className="block rounded-lg border border-border bg-ink-850 px-3 py-2 text-[12px] text-slate-300 transition-colors hover:border-slate-300/30">
          Pre-registered validation against NASA-documented analog sites →
        </Link>
      </div>
      <div className="px-3 pb-1 pt-3">
        <Tabs value={ui.tab} onValueChange={(v) => ui.setTab(v as ListTab)}>
          <TabsList className="h-8">
            <TabsTrigger value="top" className="px-2.5 text-xs">
              Top analogs
            </TabsTrigger>
            <TabsTrigger value="novel" className="px-2.5 text-xs">
              Novel leads
            </TabsTrigger>
            <TabsTrigger value="leaders" className="px-2.5 text-xs">
              Per dimension
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {ui.tab === 'leaders' && (
          <div role="radiogroup" aria-label="Dimension" className="mt-2 flex flex-wrap gap-1">
            {leaderDims.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={ui.leaderDim === d}
                onClick={() => ui.setLeaderDim(d)}
                className={cn('rounded-full border px-2 py-0.5 text-[11px]', ui.leaderDim === d ? 'border-slate-300/40 bg-ink-700 text-slate-100' : 'border-border text-slate-400 hover:text-slate-200')}
              >
                {DIMENSION_NAMES[d]}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          {ui.tab === 'novel'
            ? `Best places more than ${scr?.novelty_km ?? 300} km from every known analog site: candidates nobody has tested yet.`
            : ui.tab === 'leaders'
              ? 'Different places lead on different characteristics. Ranked by the full SAI among each dimension’s top cells.'
              : `Best of ${'1.9 million'} land cells screened at 0.1°, at least 50 km apart.`}
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        {screening.status === 'error' ? (
          <ErrorState title="Screening results could not be loaded." detail={screening.error.message} onRetry={screening.retry} />
        ) : (
          <CandidateList label={`Earth analogs for ${target.name}`} items={shown} noveltyKm={scr?.novelty_km ?? 300} selected={ui.place} onPick={pick} />
        )}
      </ScrollArea>
    </div>
  )

  const detail =
    ui.place && place ? (
      <PlaceDetail
        state={place}
        target={target}
        model={model}
        weights={weights}
        isBox={!!ui.box}
        terrain={terrain.state}
        storedT100={storedT100}
        onRefine={terrain.run}
        onClose={ui.clear}
        onTarget={ui.setTarget}
      />
    ) : null

  return (
    <>
      {isDesktop ? (
        <motion.aside
          initial={{ opacity: 0, x: reduced ? 0 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="surface absolute bottom-4 left-4 top-4 z-10 w-[360px] overflow-clip rounded-xl"
          aria-label="Targets, weights and Earth analogs"
        >
          {panel}
        </motion.aside>
      ) : (
        <>
          <div className="absolute inset-x-3 bottom-3 z-20 flex justify-center">
            <Button onClick={() => setListOpen(true)} className="rounded-full shadow-lg">
              <ListOrdered /> Targets and analogs
            </Button>
          </div>
          <Sheet open={listOpen} onOpenChange={setListOpen}>
            <SheetContent side="bottom" className="h-[88dvh] border-border bg-ink-900 p-0 pt-8" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetTitle className="sr-only">Targets and analogs</SheetTitle>
              {panel}
            </SheetContent>
          </Sheet>
        </>
      )}

      <MapView2
        candidates={mapCandidates}
        selected={ui.place}
        box={ui.box}
        drawing={drawing}
        layer={ui.layer}
        onPick={(p) => ui.pick(p)}
        onBox={(b) => {
          setDrawing(false)
          ui.pickBox(b)
        }}
        reducedMotion={reduced}
        padding={isDesktop ? { left: 380, right: detail ? 440 : 0, top: 60, bottom: 40 } : { left: 0, right: 0, top: 60, bottom: 60 }}
      />

      <div
        className={cn(
          'pointer-events-none absolute top-4 z-10 flex justify-center transition-[right] duration-300',
          isDesktop ? cn('left-[392px]', detail ? 'right-4 xl:right-[452px]' : 'right-4') : 'inset-x-3',
        )}
      >
        <div className="pointer-events-auto">
          <MapToolbar layer={ui.layer} onLayer={ui.setLayer} drawing={drawing} onDrawing={setDrawing} onGo={(p) => ui.pick(p)} />
        </div>
      </div>

      {isDesktop ? (
        <AnimatePresence>
          {detail && (
            <motion.aside
              initial={{ opacity: 0, x: reduced ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : 24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="surface absolute bottom-4 right-4 top-4 z-20 w-[420px] overflow-clip rounded-xl"
            >
              {detail}
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <Sheet open={!!detail} onOpenChange={(o) => !o && ui.clear()}>
          <SheetContent side="bottom" className="h-[88dvh] border-border bg-ink-900 p-0 [&>button]:hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            <SheetTitle className="sr-only">Place details</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
