import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ListOrdered } from 'lucide-react'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { CandidateList } from '@/components/explorer2/CandidateList'
import { ComparePlaces } from '@/components/explorer2/ComparePlaces'
import { DIM_ORDER, siteName } from '@/components/explorer2/labels'
import { MapToolbar } from '@/components/explorer2/MapToolbar'
import { MapView2, type MapCandidate } from '@/components/explorer2/MapView2'
import { PlaceDetail } from '@/components/explorer2/PlaceDetail'
import { PresetPicker } from '@/components/explorer2/PresetPicker'
import { TargetPicker } from '@/components/explorer2/TargetPicker'
import { twinGrids, useTerrain3dIndex } from '@/components/terrain3d/useTwin3d'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MAX_PINS, samePlace, useExplorer2State, type LatLon, type ListTab } from '@/hooks/useExplorer2State'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { presetWeights, useModel, usePlaceScore, useScreening, useTerrain100 } from '@/hooks/useV2'
import type { Model, Target } from '@/science/v2/model'
import { loadValidation } from '@/science/v2/data'
import { rank } from '@/science/v2/screening'
import type { TargetValidation } from '@/science/v2/validation'
import { DIMENSION_NAMES } from '@/science/v2/verdict'
import { countryAt, useCountries } from '@/lib/countries'
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
  // The spot picked in the search box and its name (none for countries and coordinates), kept only while the panel shows it.
  const [searched, setSearched] = useState<{ lat: number; lon: number; title: string | null } | null>(null)
  const target = targets.find((t) => t.id === ui.target) ?? targets[0]!
  const weights = presetWeights(model, ui.preset, target.body)
  const screening = useScreening(target.id)
  const scr = screening.status === 'ready' ? screening.data : null
  const place = usePlaceScore(ui.place, ui.box, target.id, weights)
  const terrain = useTerrain100(ui.place, ui.box, target.id)
  const [drawing, setDrawing] = useState(false)
  const goTo = (p: { lat: number; lon: number }, t: string | null) => {
    setSearched({ ...p, title: t })
    ui.pick(p)
  }
  const [listOpen, setListOpen] = useState(false)
  const [checks, setChecks] = useState<Record<string, TargetValidation> | null>(null)
  useEffect(() => {
    let live = true
    loadValidation().then(
      (v) => live && setChecks(v.targets),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [])
  const check = checks?.[target.id] ?? null
  const [hovered, setHovered] = useState<number | null>(null)
  const idx3d = useTerrain3dIndex()
  const has3d = useCallback((lat: number, lon: number) => !!twinGrids(idx3d, lat, lon, target.id), [idx3d, target.id])

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
  // screening cells carry their stage-2 (100 m) terrain check; reuse it instead of calling the API
  const stored100 = useMemo(() => {
    if (!scr || !ui.place) return null
    const all = [...scr.top, ...scr.novel_leads, ...Object.values(scr.dimension_leaders).flat()]
    const hit = all.find((c) => Math.abs(c.lat - ui.place!.lat) < 0.05 && Math.abs(c.lon - ui.place!.lon) < 0.05)
    return hit?.terrain_100m ?? null
  }, [scr, ui.place])
  // where the open place sits in the list on the left, for previous / next and the ↑ ↓ keys
  const at = ui.place && !ui.box ? shown.findIndex((r) => samePlace(r.candidate, ui.place!)) : -1
  const step = useCallback(
    (d: 1 | -1) => {
      const r = shown[at + d]
      if (at >= 0 && r) ui.pick({ lat: r.candidate.lat, lon: r.candidate.lon })
    },
    [shown, at, ui],
  )
  useEffect(() => {
    if (at < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return
      const el = e.target instanceof Element ? e.target : null
      // leave arrows to form fields, sliders, menus, open dialogs and the map's own keyboard panning
      if (el?.closest('input, textarea, select, [role="slider"], [role="menu"], [role="listbox"], [role="radiogroup"], [role="tablist"], [role="dialog"], .maplibregl-map')) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      step(e.key === 'ArrowDown' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, step])
  const facts = useCallback(
    (p: LatLon) => {
      if (!scr) return null
      const all = [...scr.top, ...scr.novel_leads, ...Object.values(scr.dimension_leaders).flat()]
      const hit = all.find((c) => samePlace(c, p))
      if (!hit) return null
      const s100 = hit.terrain_100m?.score
      return {
        t100: s100 !== null && s100 !== undefined && Number.isFinite(s100) ? s100 : null,
        nearest: hit.nearest_known ? `${siteName(hit.nearest_known)}, ${Math.round(hit.nearest_known_km ?? 0)} km` : null,
      }
    },
    [scr],
  )
  const pinned = !!ui.place && !ui.box && ui.pins.some((x) => samePlace(x, ui.place!))
  const leaderDims = DIM_ORDER.filter((d) => lists?.leaders[d]?.length)

  // place search: known analog sites by name, and a country goes to SolMate's best place in it
  const countries = useCountries()
  const sites = useMemo(() => model.known_analogs.sites.map((k) => ({ name: siteName(k.id), lat: k.lat, lon: k.lon })), [model])
  // Heading for the panel: the searched name while it shows that spot, else a known analog site's
  // name when the point is one (shared links), else PlaceDetail names it from region and country.
  const near = (a: { lat: number; lon: number }, d: number) => !!ui.place && Math.abs(a.lat - ui.place.lat) < d && Math.abs(a.lon - ui.place.lon) < d
  const fromSearch = !!searched && near(searched, 1e-3) && !ui.box
  const title = (fromSearch ? searched?.title : null) ?? sites.find((s) => near(s, 5e-3))?.name
  const placeKey = ui.box ? `box:${ui.box.south},${ui.box.west}` : ui.place ? `${ui.place.lat},${ui.place.lon}` : null
  const bestIn = useCallback(
    (country: string) => {
      if (!lists || !countries) return null
      const all = [...lists.top, ...lists.novel, ...Object.values(lists.leaders).flat()]
      const hit = all.filter((r) => Number.isFinite(r.sai) && countryAt(countries, r.candidate.lat, r.candidate.lon) === country).sort((a, b) => b.sai - a.sai)[0]
      return hit ? { lat: hit.candidate.lat, lon: hit.candidate.lon } : null
    },
    [lists, countries],
  )

  const pick = (lat: number, lon: number) => {
    ui.pick({ lat, lon })
    setListOpen(false)
  }

  const panel = (
    <div className={cn('flex h-full flex-col transition-opacity', screening.status === 'loading' && 'opacity-60')}>
      <div className="space-y-4 border-b border-border p-4">
        <TargetPicker targets={targets} value={target.id} onChange={ui.setTarget} />
        <PresetPicker value={ui.preset === 'lunar_ops' && target.body !== 'moon' ? 'equal' : ui.preset} onChange={ui.setPreset} body={target.body} />
        <Link to="/method#validation" className="block rounded-lg border border-border bg-ink-850 px-3 py-2 text-[12px] leading-snug text-slate-300 transition-colors hover:border-slate-300/30">
          <span className="font-medium text-slate-100">How good is this score?</span>{' '}
          {check
            ? `For ${target.name}, a documented NASA analog site outscored a comparison site ${Math.round(check.auc_equal * 100)}% of the time (50% is chance; ${check.n_positives} sites, ${check.n_controls} controls). A high score marks a candidate, not a proven analog.`
            : 'We tested it on documented NASA analog sites against comparison sites. A high score marks a candidate, not a proven analog.'}{' '}
          <span className="text-data">See the test →</span>
        </Link>
      </div>
      <div className="px-3 pb-1 pt-3">
        <Tabs value={ui.tab} onValueChange={(v) => ui.setTab(v as ListTab)}>
          <TabsList className="h-8">
            <TabsTrigger value="top" aria-controls="explorer-results" className="px-2.5 text-xs">
              Top analogs
            </TabsTrigger>
            <TabsTrigger value="novel" aria-controls="explorer-results" className="px-2.5 text-xs">
              Novel leads
            </TabsTrigger>
            <TabsTrigger value="leaders" aria-controls="explorer-results" className="px-2.5 text-xs">
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
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {ui.tab === 'novel'
            ? `Best places more than ${scr?.novelty_km ?? 300} km from every site in our reference list of known analogs: unreviewed candidates for literature checks and field review.`
            : ui.tab === 'leaders'
              ? 'Different places lead on different characteristics. Ranked by the full SAI among each dimension’s top cells.'
              : `Best of ${'1.9 million'} land cells screened at 0.1°, at least 50 km apart.`}
        </p>
      </div>
      <ScrollArea id="explorer-results" className="min-h-0 flex-1 px-2 pb-3">
        {screening.status === 'error' ? (
          <ErrorState title="Screening results could not be loaded." detail={screening.error.message} onRetry={screening.retry} />
        ) : screening.status === 'loading' ? (
          <p role="status" className="px-3 py-6 text-center text-sm text-slate-400">
            Loading Earth analogs for {target.name}…
          </p>
        ) : (
          <CandidateList
            label={`Earth analogs for ${target.name}`}
            items={shown}
            noveltyKm={scr?.novelty_km ?? 300}
            selected={ui.place}
            onPick={pick}
            has3d={has3d}
            onHover={setHovered}
          />
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
        isBox={!!ui.box}
        title={ui.box ? undefined : title}
        terrain={terrain.state}
        stored100={stored100}
        onRefine={terrain.run}
        onClose={ui.clear}
        onTarget={ui.setTarget}
        nav={at >= 0 ? { index: at, total: shown.length, onPrev: () => step(-1), onNext: () => step(1) } : null}
        pinned={pinned}
        canPin={ui.pins.length < MAX_PINS}
        onPin={() => ui.place && ui.togglePin(ui.place)}
        view3d={ui.view3d}
        onView3d={ui.setView3d}
      />
    ) : null

  return (
    <>
      {/* The map fills the screen, so the page title is for screen readers and document outline only. */}
      <h1 className="sr-only">Explorer: Earth analogs for {target.name}</h1>
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
        hovered={hovered}
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
          <MapToolbar layer={ui.layer} onLayer={ui.setLayer} drawing={drawing} onDrawing={setDrawing} onGo={goTo} placeKey={placeKey} fromSearch={fromSearch} sites={sites} bestIn={bestIn} />
        </div>
      </div>

      <div
        className={cn(
          'pointer-events-none absolute z-10 flex justify-center transition-[right] duration-300',
          isDesktop ? cn('bottom-14 left-[392px]', detail ? 'right-[452px]' : 'right-4') : 'inset-x-3 bottom-16',
        )}
      >
        <ComparePlaces
          pins={ui.pins}
          target={target}
          weights={weights}
          facts={facts}
          has3d={(p) => has3d(p.lat, p.lon)}
          onShow={(p) => ui.pick(p)}
          onRemove={ui.togglePin}
          onClear={ui.clearPins}
        />
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
