import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { Layers, ListOrdered, Mountain, Radar, Scale } from 'lucide-react'
import type { HomeData } from '@/hooks/useHomeData'
import { asset } from '@/lib/asset'
import { placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import { BODY } from '@/components/explorer/roles'
import { withTerrain100 } from '@/science/v2/screening'
import { DIMENSION_CARDS } from './dimensions'
import facts from '@/data/site_facts.json'

const STEPS = [
  {
    icon: Mountain,
    title: 'Start from NASA’s own sites.',
    body: 'The nine Artemis III candidate base regions near the lunar south pole, Jezero Crater where Perseverance landed, and Arcadia Planitia, NASA’s leading ice target for a human base on Mars.',
    tone: 'var(--reference)',
  },
  {
    icon: Layers,
    title: `Read Earth with ${facts.nasa_layers} NASA data layers.`,
    body: 'MODIS temperature, snow, albedo and land cover; ASTER minerals; MERRA-2 dust; NASA POWER climate; GLDAS soil moisture; SRTM terrain. Every land cell on a 0.1° grid, about 1.9 million of them.',
    tone: 'var(--data)',
  },
  {
    icon: Scale,
    title: 'Seven characteristics, one index.',
    body: 'Each characteristic is matched to the target’s value, or ranked toward it where no place on Earth gets there: nowhere on Earth is as cold or as dry as the lunar south pole. The SolMate Analog Index averages them, with weights you can change.',
    tone: 'var(--derived)',
  },
  {
    icon: ListOrdered,
    title: 'Check the method against NASA.',
    body: 'Sites NASA has already used as analogs should outscore farmland, forest and cities. The test was written down before the results were seen, and every result is published, the weak ones included.',
    tone: 'var(--positive)',
  },
  {
    icon: Radar,
    title: 'Find places nobody has tested.',
    body: 'The best cells more than 300 km from every known analog site become novel leads. They are refined with 100 m NASA terrain and listed for expert and field review.',
    tone: 'var(--screen)',
  },
]

/* --------------------------------------------------------------------------------------- visuals */

function TargetsVisual({ data }: { data: HomeData }) {
  const mars = data.targets.filter((t) => t.body === 'mars').map((t) => t.name.split(' (')[0])
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        {data.flagships.map((f, i) => (
          <motion.figure
            key={f.target.id}
            initial={{ opacity: 0, y: 20, rotate: i ? 2 : -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-xl border border-white/10"
          >
            <img src={asset(f.quicklooks.hillshade)} alt={`${f.short} shaded relief`} className="h-full w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/95 to-transparent p-3 pt-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: BODY[f.target.body].color }}>
                {BODY[f.target.body].label}
              </p>
              <p className="text-sm font-medium text-slate-100">{f.short}</p>
            </figcaption>
          </motion.figure>
        ))}
      </div>
      <p className="text-xs text-slate-300">
        <span className="tabular text-slate-100">{data.targets.length}</span> targets: {data.targets.length - mars.length} Artemis III regions, {mars.join(' and ')}.
      </p>
    </div>
  )
}

const DATASETS = ['MODIS LST', 'MODIS snow', 'MODIS albedo', 'MODIS land cover', 'ASTER GED', 'MERRA-2 dust', 'NASA POWER', 'SRTMGL30', 'ASTER GDEM']

function LayersVisual(_props: { data: HomeData }) {
  return (
    <div className="relative h-full overflow-hidden">
      <img src={asset('media/earth-1k.webp')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      {/* the analysis grid, drawn coarse (10 degrees) so it reads at this size */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 37 }, (_, i) => (
          <motion.line key={`v${i}`} x1={i * 10} x2={i * 10} y1={0} y2={180} stroke="rgb(127 216 230 / 0.35)" strokeWidth={0.4} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.02 }} />
        ))}
        {Array.from({ length: 19 }, (_, i) => (
          <motion.line key={`h${i}`} y1={i * 10} y2={i * 10} x1={0} x2={360} stroke="rgb(127 216 230 / 0.35)" strokeWidth={0.4} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.03 }} />
        ))}
      </svg>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="absolute inset-x-4 bottom-4 rounded-lg border border-white/10 bg-ink-950/95 p-3">
        <p className="text-sm text-slate-100">
          <span className="tabular text-xl">{facts.nasa_layers}</span> NASA layers · <span className="tabular text-xl">1.9 M</span> land cells at 0.1°
        </p>
        <ul className="mt-2 flex flex-wrap gap-1">
          {DATASETS.map((d) => (
            <li key={d} className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-slate-300">
              {d}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}

function ScoreVisual({ data }: { data: HomeData }) {
  const f = data.flagships[0]!
  const best = f.top[0]!
  const dims = withTerrain100(best.candidate.dims, best.candidate.terrain_100m?.score)
  const place = placeLabel(best.candidate.lat, best.candidate.lon)
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-6">
      <p className="font-mono text-[11px] text-slate-400">
        <span style={{ color: BODY[f.target.body].color }}>{f.short}</span> vs <span className="text-data">{place.name}</span>
      </p>
      {DIMENSION_CARDS.filter((d) => d.id in dims).map((d, i) => {
        const v = dims[d.id]!
        return (
          <div key={d.id}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-200">{d.short}</span>
              <span className="tabular text-slate-400">{Number.isFinite(v) ? Math.round(v * 100) : '–'}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-derived to-data"
                initial={{ width: 0 }}
                animate={{ width: `${Number.isFinite(v) ? v * 100 : 0}%` }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-sm text-slate-300">
        Analog Index <span className="tabular text-2xl text-slate-100">{Math.round(best.sai)}</span>
        <span className="text-slate-400"> /100</span>
      </p>
    </div>
  )
}

function ValidateVisual({ data }: { data: HomeData }) {
  const f = data.flagships[0]!
  const v = f.validation
  const rows = [
    { label: 'Sites NASA has used as analogs', color: 'var(--data)', items: Object.values(v.positives) },
    { label: 'Controls: farmland, forest, cities, ice', color: 'var(--slate-400)', items: Object.values(v.controls) },
  ]
  const all = rows.flatMap((r) => r.items.map((x) => x.sai ?? 0))
  const lo = Math.min(...all) - 3
  const hi = Math.max(...all) + 3
  const x = (s: number) => `${((s - lo) / (hi - lo)) * 100}%`
  return (
    <div className="flex h-full flex-col justify-center gap-5 p-6">
      <div className="flex items-end justify-between gap-4">
        <p className="font-mono text-[11px] text-slate-400">Analog Index for {f.short}, every validation site</p>
        <p className="text-right">
          <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">AUC</span>
          <span className="tabular text-3xl text-positive">{v.auc_equal.toFixed(2)}</span>
          <span className="block font-mono text-[11px] text-slate-400">
            95% CI {v.auc_ci95[0].toFixed(2)}–{v.auc_ci95[1].toFixed(2)}
          </span>
        </p>
      </div>
      {rows.map(({ label, color, items }, ri) => (
        <div key={label}>
          <p className="mb-1.5 text-xs" style={{ color }}>
            {label} <span className="text-slate-400">({items.length})</span>
          </p>
          <div className="relative h-7 rounded-full bg-white/5">
            {items.map((r, i) => (
              <motion.span
                key={i}
                initial={{ left: '0%', opacity: 0 }}
                animate={{ left: x(r.sai ?? 0), opacity: 1 }}
                transition={{ delay: 0.2 + ri * 0.15 + i * 0.03, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-ink-950"
                style={{ borderColor: color, borderStyle: ri ? 'dashed' : 'solid' }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between font-mono text-[11px] text-slate-400">
        <span>lower index</span>
        <span>higher index →</span>
      </div>
    </div>
  )
}

function DiscoverVisual({ data }: { data: HomeData }) {
  const leads = data.flagships.flatMap((f) => f.screening.novel_leads)
  const known = data.model.known_analogs.sites
  return (
    <div className="relative h-full overflow-hidden">
      <img src={asset('media/earth-1k.webp')} alt="" className="absolute inset-0 h-full w-full object-fill opacity-60" />
      <div className="absolute inset-0">
        {known.map((k) => (
          <span
            key={k.id}
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-data/80"
            style={{ left: `${((k.lon + 180) / 360) * 100}%`, top: `${((90 - k.lat) / 180) * 100}%` }}
          />
        ))}
        {leads.map((s, i) => (
          <motion.span
            key={`${s.lat},${s.lon},${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + (i % 50) * 0.015, type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-screen"
            style={{ left: `${((s.lon + 180) / 360) * 100}%`, top: `${((90 - s.lat) / 180) * 100}%` }}
          />
        ))}
      </div>
      <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-ink-950/95 px-3 py-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-screen">Novel leads · unreviewed</p>
        <p className="text-sm text-slate-100">Pink: over {data.model.known_analogs.novelty_km} km from every known site (rings)</p>
      </div>
    </div>
  )
}

const VISUALS = [TargetsVisual, LayersVisual, ScoreVisual, ValidateVisual, DiscoverVisual]

function Step({ i, active, onActive }: { i: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // active while the text itself crosses the middle band of the screen, level with the pinned visual
  const inView = useInView(ref, { margin: '-42% 0px -42% 0px' })
  useEffect(() => {
    if (inView) onActive(i)
  }, [inView, i, onActive])
  const s = STEPS[i]!
  return (
    <div className="flex min-h-[62svh] items-center py-10 lg:min-h-[78svh]">
      {/* the active step is carried by colour, not opacity, so steps ahead stay readable */}
      <motion.div ref={ref} animate={{ x: active ? 0 : -6 }} transition={{ duration: 0.4 }} className="max-w-md">
        <s.icon aria-hidden="true" className="size-5 transition-colors duration-300" style={{ color: active ? s.tone : 'var(--slate-400)' }} />
        <h3 className={cn('mt-3 text-balance text-2xl font-semibold tracking-tight transition-colors duration-300 md:text-3xl', active ? 'text-slate-100' : 'text-slate-400')}>{s.title}</h3>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-slate-300">{s.body}</p>
      </motion.div>
    </div>
  )
}

/**
 * Scrollytelling: the visual stays pinned while the five pipeline steps scroll past.
 * On phones the visual pins to the top half and the text scrolls underneath.
 */
export function HowItWorks({ data }: { data: HomeData }) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 })
  const Visual = VISUALS[active]!

  return (
    <div ref={ref} className="relative grid gap-x-12 lg:grid-cols-[1fr_1.1fr]">
      {/* pinned visual */}
      <div className="sticky top-16 z-10 -mx-6 bg-background/97 px-6 pb-4 pt-3 lg:order-2 lg:top-24 lg:mx-0 lg:h-[calc(100svh-8rem)] lg:bg-transparent lg:px-0 lg:py-0">
        <div className="relative h-[34svh] overflow-hidden rounded-2xl border border-border bg-ink-900 lg:h-full lg:max-h-[620px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 1.02 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <Visual data={data} />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* step dots + progress */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={cn('h-1.5 rounded-full transition-all duration-500', i === active ? 'w-6' : 'w-1.5 bg-white/20')}
                style={i === active ? { background: s.tone } : undefined}
              />
            ))}
          </div>
          <div className="h-px flex-1 overflow-hidden bg-white/10">
            <motion.div className="h-full origin-left bg-gradient-to-r from-reference via-derived to-screen" style={{ scaleX: progress }} />
          </div>
          <span className="font-mono text-[11px] tabular text-slate-400">0{active + 1}/05</span>
        </div>
      </div>

      {/* scrolling steps */}
      <div className="lg:order-1">
        {STEPS.map((s, i) => (
          <Step key={s.title} i={i} active={i === active} onActive={setActive} />
        ))}
      </div>
    </div>
  )
}
