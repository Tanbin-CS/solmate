import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ListOrdered } from 'lucide-react'
import { useAnalysisData } from '@/hooks/useAnalysisData'
import { useExplorerState } from '@/hooks/useExplorerState'
import { analyse } from '@/science/analysis'
import { MapView } from '@/components/explorer/MapView'
import { RankList } from '@/components/explorer/RankList'
import { WeightPanel } from '@/components/explorer/WeightPanel'
import { SiteDetail } from '@/components/explorer/SiteDetail'
import { ReferenceCard } from '@/components/explorer/ReferenceCard'
import { EvidenceBadge } from '@/components/explorer/EvidenceBadge'
import { LayerToggle, MapLegend } from '@/components/explorer/MapOverlays'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { AnalysisData } from '@/data/load'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const EASE = [0.16, 1, 0.3, 1] as const

// The roughness group (r ≈ 0.98–1.00 across sites) shares one indicator's worth of weight.
const BALANCED: Record<string, number> = { slope_median: 0.35, local_relief: 0.35, ruggedness: 0.35, slope_p90: 1, hypsometric_integral: 1 }

export default function ExplorerPage() {
  const state = useAnalysisData()
  if (state.status === 'error') {
    return <ErrorState title="The analysis data could not be loaded." detail={state.error.message} onRetry={state.retry} />
  }
  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-clip bg-ink-950">
      {state.status === 'loading' ? (
        <div className="surface absolute left-4 top-4 w-[360px] rounded-xl">
          <PanelSkeleton />
        </div>
      ) : (
        <Explorer data={state.data} />
      )}
    </div>
  )
}

function Explorer({ data }: { data: AnalysisData }) {
  const { indicators: doc, validation } = data
  const reduced = useReducedMotion() ?? false
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const ui = useExplorerState(doc.profile.scored)
  const [hovered, setHovered] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const analysis = useMemo(() => analyse(doc, ui.weights), [doc, ui.weights])
  const selected = ui.selected ? analysis.byId.get(ui.selected) ?? null : null
  const meta = doc.profile.indicators.filter((m) => doc.profile.scored.includes(m.id))
  const retrieval = validation.retrieval

  const sensitivityRanks = selected
    ? validation.sensitivity
        .filter((c) => c.id !== 'primary')
        .map((c) => ({ label: c.cell_m === 200 ? 'At 200 m cells' : `In ${c.window_m / 1000} km window`, rank: c.ranks[selected.site.id] ?? 0 }))
    : []

  const panel = (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-border p-4">
        <ReferenceCard reference={doc.reference} />
        <Link
          to="/method#validation"
          className="block rounded-lg border border-border bg-ink-850 px-3 py-2.5 transition-colors hover:border-slate-300/30"
        >
          <span className="label-mono">Method check · known-analog retrieval</span>
          <span className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-slate-200">NASA-documented Mars analogs vs controls</span>
            <span className="font-mono text-sm text-positive">AUC {retrieval.auc_mars_documented.toFixed(2)}</span>
          </span>
        </Link>
        <WeightPanel
          indicators={meta}
          weights={ui.weights}
          isDefault={ui.isDefaultWeights}
          onChange={ui.setWeight}
          onReset={ui.resetWeights}
          onBalanced={() => ui.setAllWeights(BALANCED)}
          isBalanced={Object.entries(BALANCED).every(([k, v]) => ui.weights[k] === v)}
        />
      </div>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="label-mono">Earth sites · ranked</h2>
        <span className="font-mono text-[11px] text-slate-400">similarity / 100</span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        <RankList
          results={analysis.results}
          selectedId={ui.selected}
          hoveredId={hovered}
          rankRange={validation.weight_perturbation.rank_range}
          onSelect={(id) => {
            ui.select(id)
            setListOpen(false)
          }}
          onHover={setHovered}
        />
      </ScrollArea>
    </div>
  )

  const detail = selected && (
    <SiteDetail
      result={selected}
      reference={doc.reference}
      referenceValues={analysis.reference}
      indicators={meta}
      weights={ui.weights}
      rankRange={validation.weight_perturbation.rank_range[selected.site.id]}
      sensitivityRanks={sensitivityRanks}
      total={analysis.results.length}
      onClose={() => ui.select(null)}
      evidence={<EvidenceBadge result={data.claims?.results[selected.site.id]} doc={data.claims} />}
    />
  )

  return (
    <>
      <MapView
        results={analysis.results}
        selectedId={ui.selected}
        hoveredId={hovered}
        layer={ui.layer}
        onSelect={ui.select}
        onHover={setHovered}
        reducedMotion={reduced}
        padding={isDesktop ? { left: 380, right: selected ? 440 : 0, top: 60, bottom: 40 } : { left: 0, right: 0, top: 60, bottom: 60 }}
      />

      {isDesktop ? (
        <motion.aside
          initial={{ opacity: 0, x: reduced ? 0 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="surface absolute bottom-4 left-4 top-4 w-[360px] overflow-clip rounded-xl"
          aria-label="Analysis controls and ranking"
        >
          {panel}
        </motion.aside>
      ) : (
        <>
          <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center">
            <Button onClick={() => setListOpen(true)} className="rounded-full shadow-lg">
              <ListOrdered /> Ranking and weights
            </Button>
          </div>
          <Sheet open={listOpen} onOpenChange={setListOpen}>
            <SheetContent side="bottom" className="h-[85dvh] border-border bg-ink-900 p-0">
              <SheetTitle className="sr-only">Ranking and weights</SheetTitle>
              {panel}
            </SheetContent>
          </Sheet>
        </>
      )}

      <div className={`pointer-events-none absolute top-4 z-10 flex justify-center ${isDesktop ? 'left-[392px] right-4' : 'inset-x-3'}`}>
        <div className="pointer-events-auto">
          <LayerToggle layer={ui.layer} onChange={ui.setLayer} />
        </div>
      </div>
      {isDesktop && (
        <div className="pointer-events-none absolute bottom-4 left-[392px] right-16 z-10 flex justify-center">
          <div className="pointer-events-auto">
            <MapLegend />
          </div>
        </div>
      )}

      {isDesktop ? (
        <AnimatePresence>
          {detail && (
            <motion.aside
              key="detail"
              initial={{ opacity: 0, x: reduced ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : 24 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="surface absolute bottom-4 right-4 top-4 z-20 w-[420px] overflow-clip rounded-xl"
            >
              {detail}
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <Sheet open={!!detail} onOpenChange={(o) => !o && ui.select(null)}>
          <SheetContent side="bottom" className="h-[88dvh] border-border bg-ink-900 p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">{selected?.site.name ?? 'Site details'}</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
