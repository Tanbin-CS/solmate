import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DIMENSION_CARDS } from '@/components/home/dimensions'
import { DimensionBars } from '@/components/explorer2/DimensionBars'
import facts from '@/data/site_facts.json'
import { usePlaceScore } from '@/hooks/useV2'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import { DIMENSION_NAMES, EARTH_OBLIQUITY, MOON_OBLIQUITY, maxSunElevation } from '@/science/v2/verdict'
import { alike, EARTH_DOSE_MSV_DAY, type Visual } from './content'
import { breaksDown, EARTH_G, EARTH_HPA, type LearnData } from './data'

const ease = [0.16, 1, 0.3, 1] as const
const px = (lon: number) => `${((lon + 180) / 360) * 100}%`
const py = (lat: number) => `${((90 - lat) / 180) * 100}%`

/** What a few regions are known for (targets.yaml region notes), for the region list. */
const REGION_NOTES: Readonly<Record<string, string>> = {
  peak_near_cabeus_b: 'Smallest landing area',
  haworth: 'Next to a −163 °C cold trap',
  malapert_massif: 'A huge mountain',
  mons_mouton_plateau: 'Largest and flattest',
  mons_mouton: 'Top of a flat-topped mountain',
  nobile_rim_1: 'Rim of Nobile crater',
  nobile_rim_2: 'Other rim of Nobile crater',
  de_gerlache_rim_2: 'Closest to the pole',
  slater_plain: 'Most safe landing ground',
}

export function CardVisual({ visual, data }: { visual: Visual; data: LearnData | null }) {
  switch (visual.kind) {
    case 'image':
      return (
        <Frame credit={visual.credit}>
          <img src={asset(visual.src)} alt={visual.alt} className="h-full w-full object-cover" style={{ objectPosition: visual.focus ?? '50% 50%' }} />
        </Frame>
      )
    case 'south-pole':
      return <SouthPole />
    case 'analog-map':
      return <AnalogMap data={data} />
    case 'dimensions':
      return <Dimensions />
    case 'layers':
      return <Layers />
    case 'grid':
      return <GridZoom />
    case 'bars':
      return <LiveBars visual={visual} data={data} />
    case 'sun':
      return <SunHeights targetId={visual.target} data={data} />
    case 'regions':
      return <Regions data={data} />
    case 'gravity':
      return <Gravity data={data} />
    case 'pressure':
      return <Pressure data={data} />
    case 'radiation':
      return <Radiation data={data} />
    case 'validation':
      return <ValidationDots data={data} />
  }
}

function Frame({ children, credit, className }: { children: React.ReactNode; credit?: string; className?: string }) {
  return (
    <figure className="flex h-full flex-col">
      <div className={cn('relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-ink-950', className)}>{children}</div>
      {credit && <figcaption className="mt-2 font-mono text-[10.5px] text-slate-400">{credit}</figcaption>}
    </figure>
  )
}

function Panel({ children, credit }: { children: React.ReactNode; credit?: string }) {
  return (
    <Frame credit={credit} className="flex flex-col justify-center p-5 sm:p-7">
      {children}
    </Frame>
  )
}

function SouthPole() {
  const reduced = useReducedMotion()
  return (
    <Frame credit="NASA LRO LROC WAC mosaic">
      <img src={asset('media/globe-moon.webp')} alt="The Moon, with its south pole at the bottom" className="absolute inset-0 m-auto h-full object-contain" />
      <motion.span
        aria-hidden="true"
        className="absolute left-1/2 top-[86%] size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-reference"
        initial={false}
        animate={reduced ? { opacity: 1 } : { scale: [0.85, 1.1, 0.85], opacity: [0.9, 0.5, 0.9] }}
        transition={{ duration: 2.4, repeat: reduced ? 0 : Infinity, ease: 'easeInOut' }}
      />
      <span className="absolute left-1/2 top-[86%] ml-11 -translate-y-1/2 rounded bg-ink-950/85 px-2 py-1 text-xs font-medium text-reference">
        South pole: Artemis regions
      </span>
    </Frame>
  )
}

function EarthMap({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative aspect-[2/1] w-full overflow-hidden', className)}>
      <img src={asset('media/earth-1k.webp')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 saturate-[0.8]" />
      {children}
    </div>
  )
}

function siteName(id: string) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function AnalogMap({ data }: { data: LearnData | null }) {
  const reduced = useReducedMotion()
  const sites = data?.model.known_analogs.sites ?? []
  const [pick, setPick] = useState<string | null>(null)
  const sel = sites.find((s) => s.id === pick)
  return (
    <Frame credit="Field sites already used as analogs (NASA, ESA and partners) on NASA Blue Marble">
      <div className="flex h-full items-center">
        <EarthMap>
          {sites.map((s, i) => (
            <motion.button
              key={s.id}
              type="button"
              aria-label={siteName(s.id)}
              aria-pressed={pick === s.id}
              onClick={() => setPick(s.id)}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: px(s.lon), top: py(s.lat) }}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.4 }}
              viewport={{ once: true }}
              transition={{ delay: reduced ? 0 : 0.1 + i * 0.03, type: 'spring', stiffness: 380, damping: 20 }}
            >
              <span className={cn('size-2.5 rounded-full border-2 transition-colors', pick === s.id ? 'border-white bg-reference' : 'border-reference bg-reference/40')} />
            </motion.button>
          ))}
        </EarthMap>
      </div>
      <p className="absolute bottom-3 left-3 right-3 rounded-lg bg-ink-950/90 px-2.5 py-1.5 text-xs text-slate-200" aria-live="polite">
        {sel ? (
          <>
            <span className="font-medium text-reference">{siteName(sel.id)}</span> · listed by {sel.source ?? 'analog missions'}
          </>
        ) : (
          <>
            <span className="tabular text-reference">{sites.length || '…'}</span> places already used to practise. Tap a dot to see its name.
          </>
        )}
      </p>
    </Frame>
  )
}

function Dimensions() {
  const [open, setOpen] = useState(DIMENSION_CARDS[0]!.id)
  const card = DIMENSION_CARDS.find((d) => d.id === open)!
  return (
    <Panel credit="Sources: docs/DATA_SOURCES.md">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="The seven characteristics">
        {DIMENSION_CARDS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={open === d.id}
            onClick={() => setOpen(d.id)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-[11px] transition-colors',
              open === d.id ? 'border-data/60 bg-data/10 text-data' : 'border-border text-slate-300 hover:border-slate-300/40 hover:text-slate-100',
            )}
          >
            <d.icon className="size-5" aria-hidden="true" />
            {d.short}
          </button>
        ))}
      </div>
      <div className="mt-5 min-h-[4.5rem]" aria-live="polite">
        <p className="text-base font-medium text-slate-100">{DIMENSION_NAMES[card.id] ?? card.short}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">Measured with {card.sources}.</p>
      </div>
    </Panel>
  )
}

const LAYER_STACK = ['SRTM height', 'NASA POWER climate', 'MODIS temperature', 'MODIS snow', 'MODIS land cover', 'ASTER minerals', 'MERRA-2 dust', 'GLDAS soil moisture']

function Layers() {
  const reduced = useReducedMotion()
  const [n, setN] = useState(3)
  const all = n >= LAYER_STACK.length
  return (
    <Panel credit="Layer list: Data page">
      <div className="relative mx-auto h-48 w-full max-w-sm" aria-hidden="true">
        <AnimatePresence>
          {LAYER_STACK.slice(0, n).map((name, i) => (
            <motion.div
              key={name}
              className="absolute inset-x-0 flex h-9 items-center rounded-lg border border-data/30 bg-ink-800/95 px-3 text-xs text-slate-200 shadow-[0_10px_24px_-14px_rgb(0_0_0/0.9)]"
              style={{ bottom: i * 19, zIndex: i, left: i * 5 }}
              initial={reduced ? false : { opacity: 0, y: -60, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            >
              {name}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        {all ? (
          <p className="text-center text-sm text-slate-300">
            <span className="tabular text-2xl font-semibold text-data">{facts.nasa_layers}</span> NASA data layers in all, stacked on every square
          </p>
        ) : (
          <button type="button" onClick={() => setN((v) => v + 1)} className="rounded-full border border-data/50 bg-data/10 px-4 py-2 text-sm font-medium text-data transition-colors hover:bg-data/20">
            Add a layer ({n} of {LAYER_STACK.length})
          </button>
        )}
        {all && (
          <button type="button" onClick={() => setN(1)} className="text-xs text-slate-400 underline-offset-2 hover:underline">
            Again
          </button>
        )}
      </div>
    </Panel>
  )
}

function GridZoom() {
  const [z, setZ] = useState(1)
  const k = (z - 1) / 5 // 0..1
  return (
    <Frame credit="NASA Blue Marble; grid of 0.1° squares">
      <div className="relative h-full overflow-hidden">
        <div className="absolute inset-0 flex items-center will-change-transform" style={{ transform: `scale(${z})`, transformOrigin: '72% 33%', transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
          <EarthMap>
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                opacity: 0.15 + k * 0.6,
                backgroundImage: 'linear-gradient(rgb(127 216 230 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(127 216 230 / 0.5) 1px, transparent 1px)',
                backgroundSize: `${2.5 / Math.max(1, z / 2)}% ${5 / Math.max(1, z / 2)}%`,
              }}
            />
          </EarthMap>
        </div>
      </div>
      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-ink-950/90 px-3 py-2">
        <label className="flex items-center gap-3 text-xs text-slate-200">
          Zoom in
          <input type="range" min={1} max={6} step={0.1} value={z} onChange={(e) => setZ(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-[var(--data)]" />
        </label>
        <p className="mt-1 text-xs text-slate-300">
          {z < 4 ? (
            'Slide to zoom in on the squares.'
          ) : (
            <>
              Each square is about 11 km wide. There are about <span className="tabular text-data">1.9 million</span> on land.
            </>
          )}
        </p>
      </div>
    </Frame>
  )
}

const COMPARE = [
  { name: 'Sahara Desert, Algeria', lat: 24.5, lon: 5.5 },
  { name: 'Amazon rainforest, Brazil', lat: -2.6, lon: -60.2 },
]

function LiveBars({ visual, data }: { visual: Extract<Visual, { kind: 'bars' }>; data: LearnData | null }) {
  const places = [{ name: visual.caption.split(' against ')[0] ?? 'This place', lat: visual.lat, lon: visual.lon }, ...COMPARE]
  const [n, setN] = useState(0)
  const at = places[n]!
  const weights = data?.model.presets.equal ?? null
  const state = usePlaceScore({ lat: at.lat, lon: at.lon }, null, visual.target, weights)
  const verdict = state?.status === 'ready' ? state.data.verdict : null
  const target = data?.targets.find((t) => t.id === visual.target)?.name ?? ''
  return (
    <Panel credit="Scored live in your browser from NASA data">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a place">
        {places.map((p, i) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={n === i}
            onClick={() => setN(i)}
            className={cn('rounded-full border px-2.5 py-1 text-[11.5px] transition-colors', n === i ? 'border-data/60 bg-data/10 text-data' : 'border-border text-slate-300 hover:text-slate-100')}
          >
            {p.name.split(',')[0]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-300">
        {at.name.split(',')[0]} against {target}
      </p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular text-slate-100">{verdict?.sai != null ? verdict.sai.toFixed(0) : '…'}</span>
        <span className="text-base text-slate-400">/100</span>
        {verdict?.sai != null && <span className={cn('text-sm', alike(verdict.sai).tone)}>{alike(verdict.sai).word}</span>}
      </p>
      <div className="mt-3">{verdict && data ? <DimensionBars verdict={verdict} model={data.model} /> : <p className="text-sm text-slate-400">Scoring…</p>}</div>
    </Panel>
  )
}

const EARTH_PLACES = [
  { name: 'Dhaka', lat: 23.8 },
  { name: 'Oslo', lat: 59.9 },
  { name: 'Quito, on the equator', lat: -0.2 },
]

function SunHeights({ targetId, data }: { targetId: string; data: LearnData | null }) {
  const [n, setN] = useState(0)
  const t = data?.targets.find((x) => x.id === targetId)
  const tlat = (t as { centroid?: { lat?: number } } | undefined)?.centroid?.lat
  const moon = tlat === undefined ? null : maxSunElevation(tlat, MOON_OBLIQUITY)
  const place = EARTH_PLACES[n]!
  const earth = maxSunElevation(place.lat, EARTH_OBLIQUITY)
  return (
    <Panel credit="Highest midsummer noon Sun, from latitude and axis tilt">
      <div className="grid grid-cols-2 gap-4">
        <SunArc angle={moon} label={t?.name ?? 'Moon region'} tone="var(--reference)" />
        <SunArc angle={earth} label={`${place.name}, on Earth`} tone="var(--data)" />
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Pick a place on Earth">
        {EARTH_PLACES.map((p, i) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={n === i}
            onClick={() => setN(i)}
            className={cn('rounded-full border px-2.5 py-1 text-[11.5px] transition-colors', n === i ? 'border-data/60 bg-data/10 text-data' : 'border-border text-slate-300 hover:text-slate-100')}
          >
            {p.name.split(',')[0]}
          </button>
        ))}
      </div>
    </Panel>
  )
}

function SunArc({ angle, label, tone }: { angle: number | null; label: string; tone: string }) {
  const reduced = useReducedMotion()
  const a = ((angle ?? 0) * Math.PI) / 180
  const r = 70
  const sx = 90 - r * Math.cos(a)
  const sy = 90 - r * Math.sin(a)
  return (
    <figure className="text-center">
      <svg viewBox="0 0 180 100" className="w-full" role="img" aria-label={`${label}: the Sun reaches ${angle === null ? 'unknown' : Math.round(angle)} degrees`}>
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--ink-500)" strokeDasharray="3 4" />
        <line x1="8" y1="90" x2="172" y2="90" stroke="var(--slate-400)" />
        <motion.line x1="90" y1="90" initial={false} animate={{ x2: sx, y2: sy }} transition={{ duration: reduced ? 0 : 1.4, ease }} stroke={tone} strokeOpacity="0.5" />
        <motion.circle
          r="8"
          fill={tone}
          initial={reduced ? false : { cx: 20, cy: 90 }}
          animate={{ cx: sx, cy: sy }}
          transition={{ duration: reduced ? 0 : 1.4, ease }}
          cx={sx}
          cy={sy}
        />
      </svg>
      <figcaption className="mt-1">
        <span className="tabular text-2xl font-semibold" style={{ color: tone }}>
          {angle === null ? '…' : `${Math.round(angle)}°`}
        </span>
        <span className="block text-xs text-slate-300">{label}</span>
      </figcaption>
    </figure>
  )
}

function Regions({ data }: { data: LearnData | null }) {
  const moon = (data?.targets ?? []).filter((t) => t.body === 'moon')
  return (
    <Panel credit="NASA candidate landing regions (28 Oct 2024); highest Sun from each region's latitude">
      <ul className="grid gap-x-5 gap-y-1.5 text-[13px] sm:grid-cols-2">
        {moon.map((t) => {
          const lat = (t as { centroid?: { lat?: number } }).centroid?.lat
          return (
            <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1">
              <span className="min-w-0">
                <span className="block truncate text-slate-100">{t.name}</span>
                <span className="block truncate text-[11.5px] text-slate-400">{REGION_NOTES[t.id]}</span>
              </span>
              <span className="shrink-0 tabular text-reference">{lat === undefined ? '' : `Sun ≤ ${Math.round(maxSunElevation(lat, MOON_OBLIQUITY))}°`}</span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function Bars({ rows, credit, unit }: { rows: { label: string; value: number; text: string; tone: string }[]; credit: string; unit: string }) {
  const reduced = useReducedMotion()
  const max = Math.max(...rows.map((r) => r.value))
  return (
    <Panel credit={credit}>
      <ul className="space-y-4" aria-label={unit}>
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-100">{r.label}</span>
              <span className="tabular text-slate-200">{r.text}</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-ink-700" aria-hidden="true">
              <motion.div
                className="h-full rounded-full"
                style={{ background: r.tone }}
                initial={reduced ? false : { width: 0 }}
                whileInView={{ width: `${Math.max(1, (r.value / max) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ delay: reduced ? 0 : 0.1 + i * 0.15, duration: reduced ? 0 : 0.9, ease }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

const moonT = (d: LearnData | null) => d?.targets.find((t) => t.body === 'moon')
const marsT = (d: LearnData | null) => d?.targets.find((t) => t.id === 'jezero_crater')

/** Drop a ball from the same height on three worlds; fall times follow t = sqrt(2h/g), shown 1.6 times slower. */
function Gravity({ data }: { data: LearnData | null }) {
  const reduced = useReducedMotion()
  const mars = breaksDown(marsT(data), 'gravity_m_s2') ?? 3.73
  const moon = breaksDown(moonT(data), 'gravity_m_s2') ?? 1.62
  const [drop, setDrop] = useState(0)
  const worlds = [
    { name: 'Earth', g: EARTH_G, tone: 'bg-data', text: 'text-data' },
    { name: 'Mars', g: mars, tone: 'bg-mars', text: 'text-mars' },
    { name: 'Moon', g: moon, tone: 'bg-reference', text: 'text-reference' },
  ]
  const H = 1.5 // metres
  return (
    <Panel credit="Gravity: NASA planetary fact sheets. Each ball falls 1.5 m, shown 1.6 times slower">
      <div className="grid h-36 grid-cols-3 gap-3">
        {worlds.map((w) => {
          const t = Math.sqrt((2 * H) / w.g)
          return (
            <div key={w.name} className="relative rounded-lg border border-border bg-ink-900/60">
              <motion.span
                key={drop}
                className={cn('absolute left-1/2 top-2 -ml-3 size-6 rounded-full', w.tone)}
                initial={{ y: 0 }}
                animate={{ y: drop ? 96 : 0 }}
                transition={{ duration: drop && !reduced ? t * 1.6 : 0, ease: [0.4, 0, 1, 1] }}
              />
              <span className="absolute inset-x-2 bottom-2 h-0.5 rounded bg-slate-400/50" />
            </div>
          )
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
        {worlds.map((w) => {
          const t = Math.sqrt((2 * H) / w.g)
          return (
            <span key={w.name} className="text-slate-200">
              {w.name}
              <span className="block text-[11px] text-slate-400">{(w.g / EARTH_G).toFixed(2)} × Earth</span>
              {drop > 0 && (
                <motion.span key={`t${drop}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : t * 1.6 }} className={cn('block tabular text-xs font-semibold', w.text)}>
                  landed in {t.toFixed(2)} s
                </motion.span>
              )}
            </span>
          )
        })}
      </div>
      <button type="button" onClick={() => setDrop((d) => d + 1)} className="mx-auto mt-3 block rounded-full border border-data/50 bg-data/10 px-4 py-2 text-sm font-medium text-data transition-colors hover:bg-data/20">
        {drop ? 'Drop them again' : 'Drop the balls!'}
      </button>
    </Panel>
  )
}

function Pressure({ data }: { data: LearnData | null }) {
  const mars = breaksDown(marsT(data), 'surface_pressure_hpa') ?? 7
  // a log scale, so the Moon's near-vacuum still shows as a sliver
  const lg = (v: number) => Math.max(0.05, Math.log10(v) + 13)
  return (
    <Bars
      unit="Air pressure at the surface"
      credit="Mars: Perseverance MEDA; Moon and Earth: NASA fact sheets. Bars on a log scale"
      rows={[
        { label: 'Earth', value: lg(EARTH_HPA), text: '1,013 hPa', tone: 'var(--data)' },
        { label: 'Mars (Jezero)', value: lg(mars), text: `${mars} hPa`, tone: 'var(--mars)' },
        { label: 'Moon', value: lg(3e-12), text: 'almost none', tone: 'var(--reference)' },
      ]}
    />
  )
}

function Radiation({ data }: { data: LearnData | null }) {
  const mars = breaksDown(marsT(data), 'radiation_dose_msv_day') ?? 0.64
  const moon = breaksDown(moonT(data), 'radiation_dose_msv_day') ?? 1.369
  const times = (v: number) => {
    const x = v / EARTH_DOSE_MSV_DAY
    const p = 10 ** Math.floor(Math.log10(x))
    return `about ${(Math.round(x / p) * p).toLocaleString('en')} × Earth`
  }
  return (
    <Bars
      unit="Radiation dose per day"
      credit="Mars: Curiosity RAD; Moon: Chang’e-4 LND; Earth: UNSCEAR world average"
      rows={[
        { label: 'Earth', value: EARTH_DOSE_MSV_DAY, text: '1 × Earth', tone: 'var(--data)' },
        { label: 'Mars', value: mars, text: times(mars), tone: 'var(--mars)' },
        { label: 'Moon', value: moon, text: times(moon), tone: 'var(--reference)' },
      ]}
    />
  )
}

function ValidationDots({ data }: { data: LearnData | null }) {
  const reduced = useReducedMotion()
  const [run, setRun] = useState(0)
  const auc = data?.validation.targets.jezero_crater?.auc_equal ?? null
  const won = auc === null ? 0 : Math.round(auc * 100)
  return (
    <Panel credit="Pre-registered test, docs/VALIDATION.md">
      <p className="text-sm text-slate-300">100 match-ups: a real Jezero analog site against a random other place</p>
      <div key={run} className="mt-4 grid grid-cols-10 gap-1.5" role="img" aria-label={`${won} of 100 match-ups won by real analog sites`}>
        {Array.from({ length: 100 }, (_, i) => (
          <motion.span
            key={i}
            className={cn('aspect-square rounded-full', i < won ? 'bg-data' : 'bg-ink-600')}
            initial={reduced ? false : { opacity: 0, scale: 0.3 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: reduced ? 0 : i * 0.015, type: 'spring', stiffness: 500, damping: 20 }}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-200">
          Real analog sites won <span className="tabular font-semibold text-data">{auc === null ? '…' : won}</span>. Guessing would win about 50.
        </p>
        <button type="button" onClick={() => setRun((r) => r + 1)} className="shrink-0 rounded-full border border-data/50 bg-data/10 px-3 py-1.5 text-xs font-medium text-data hover:bg-data/20">
          Run again
        </button>
      </div>
    </Panel>
  )
}
