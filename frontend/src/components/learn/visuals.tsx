import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DIMENSION_CARDS } from '@/components/home/dimensions'
import { DimensionBars } from '@/components/explorer2/DimensionBars'
import facts from '@/data/site_facts.json'
import { usePlaceScore } from '@/hooks/useV2'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import { DIMENSION_NAMES, EARTH_OBLIQUITY, MOON_OBLIQUITY, maxSunElevation } from '@/science/v2/verdict'
import { EARTH_DOSE_MSV_DAY, type Visual } from './content'
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

function AnalogMap({ data }: { data: LearnData | null }) {
  const reduced = useReducedMotion()
  const sites = data?.model.known_analogs.sites ?? []
  return (
    <Frame credit="Field sites already used as analogs (NASA, ESA and partners) on NASA Blue Marble">
      <div className="flex h-full items-center">
        <EarthMap>
          {sites.map((s, i) => (
            <motion.span
              key={s.id}
              aria-hidden="true"
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-reference bg-reference/40"
              style={{ left: px(s.lon), top: py(s.lat) }}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: reduced ? 0 : 0.1 + i * 0.04, type: 'spring', stiffness: 380, damping: 20 }}
            />
          ))}
        </EarthMap>
      </div>
      <p className="absolute bottom-3 left-3 rounded bg-ink-950/85 px-2 py-1 text-xs text-slate-200">
        <span className="tabular text-reference">{sites.length || '…'}</span> places already used to practise
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
  return (
    <Panel credit="Layer list: Data page">
      <div className="relative mx-auto h-56 w-full max-w-sm" aria-hidden="true">
        {LAYER_STACK.map((name, i) => (
          <motion.div
            key={name}
            className="absolute inset-x-0 flex h-9 items-center rounded-lg border border-data/30 bg-ink-800/90 px-3 text-xs text-slate-200 shadow-[0_10px_24px_-14px_rgb(0_0_0/0.9)]"
            style={{ bottom: i * 22, zIndex: i, transform: `translateX(${i * 6}px)` }}
            initial={reduced ? false : { opacity: 0, y: -40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reduced ? 0 : 0.15 + i * 0.12, duration: 0.6, ease }}
          >
            {name}
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-slate-300">
        <span className="tabular text-2xl font-semibold text-data">{facts.nasa_layers}</span> NASA data layers in all
      </p>
    </Panel>
  )
}

function GridZoom() {
  return (
    <Frame credit="NASA Blue Marble; grid of 0.1° squares">
      <div className="flex h-full items-center">
        <EarthMap>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'linear-gradient(rgb(127 216 230 / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(127 216 230 / 0.35) 1px, transparent 1px)',
              backgroundSize: '2.5% 5%',
            }}
          />
          <div className="absolute left-[70%] top-[24%] grid size-[22%] grid-cols-5 grid-rows-5 rounded-md border-2 border-data bg-ink-950/60" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} className="border border-data/25" style={{ background: `rgb(127 216 230 / ${((i * 37) % 100) / 220})` }} />
            ))}
          </div>
        </EarthMap>
      </div>
      <p className="absolute bottom-3 left-3 rounded bg-ink-950/85 px-2 py-1 text-xs text-slate-200">
        about <span className="tabular text-data">1.9 million</span> land squares, each about 11 km wide
      </p>
    </Frame>
  )
}

function LiveBars({ visual, data }: { visual: Extract<Visual, { kind: 'bars' }>; data: LearnData | null }) {
  const weights = data?.model.presets.equal ?? null
  const state = usePlaceScore({ lat: visual.lat, lon: visual.lon }, null, visual.target, weights)
  const verdict = state?.status === 'ready' ? state.data.verdict : null
  return (
    <Panel credit="Scored live in your browser from NASA data">
      <p className="text-sm text-slate-300">{visual.caption}</p>
      <p className="mt-1 text-4xl font-semibold tabular text-slate-100">
        {verdict?.sai != null ? verdict.sai.toFixed(0) : '…'}
        <span className="ml-1 text-base font-normal text-slate-400">/100</span>
      </p>
      <div className="mt-4">{verdict && data ? <DimensionBars verdict={verdict} model={data.model} /> : <p className="text-sm text-slate-400">Scoring…</p>}</div>
    </Panel>
  )
}

const DHAKA = { name: 'Dhaka', lat: 23.8 }

function SunHeights({ targetId, data }: { targetId: string; data: LearnData | null }) {
  const t = data?.targets.find((x) => x.id === targetId)
  const tlat = (t as { centroid?: { lat?: number } } | undefined)?.centroid?.lat
  const moon = tlat === undefined ? null : maxSunElevation(tlat, MOON_OBLIQUITY)
  const earth = maxSunElevation(DHAKA.lat, EARTH_OBLIQUITY)
  return (
    <Panel credit="Highest midsummer noon Sun, from latitude and axis tilt">
      <div className="grid grid-cols-2 gap-4">
        <SunArc angle={moon} label={t?.name ?? 'Moon region'} tone="var(--reference)" />
        <SunArc angle={earth} label={`${DHAKA.name}, on Earth`} tone="var(--data)" />
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
        <line x1="90" y1="90" x2={sx} y2={sy} stroke={tone} strokeOpacity="0.5" />
        <motion.circle
          r="8"
          fill={tone}
          initial={reduced ? false : { cx: 20, cy: 90 }}
          whileInView={{ cx: sx, cy: sy }}
          viewport={{ once: true }}
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
    <Panel credit="NASA Artemis III candidate regions (28 Oct 2024); highest Sun from each region's latitude">
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

function Gravity({ data }: { data: LearnData | null }) {
  const mars = breaksDown(marsT(data), 'gravity_m_s2') ?? 3.73
  const moon = breaksDown(moonT(data), 'gravity_m_s2') ?? 1.62
  const g = (v: number) => `${(v / EARTH_G).toFixed(2)} × Earth`
  return (
    <Bars
      unit="Surface gravity"
      credit="NASA planetary fact sheets"
      rows={[
        { label: 'Earth', value: EARTH_G, text: '1 × Earth', tone: 'var(--data)' },
        { label: 'Mars', value: mars, text: g(mars), tone: 'var(--mars)' },
        { label: 'Moon', value: moon, text: g(moon), tone: 'var(--reference)' },
      ]}
    />
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
  const auc = data?.validation.targets.jezero_crater?.auc_equal ?? null
  const won = auc === null ? 0 : Math.round(auc * 100)
  return (
    <Panel credit="Pre-registered test, docs/VALIDATION.md">
      <p className="text-sm text-slate-300">Real Jezero analog sites against other places: 100 match-ups</p>
      <div className="mt-4 grid grid-cols-10 gap-1.5" role="img" aria-label={`${won} of 100 match-ups won by real analog sites`}>
        {Array.from({ length: 100 }, (_, i) => (
          <motion.span
            key={i}
            className={cn('aspect-square rounded-full', i < won ? 'bg-data' : 'bg-ink-600')}
            initial={reduced ? false : { opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: reduced ? 0 : i * 0.012, duration: 0.3 }}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-200">
        Real analog sites won <span className="tabular font-semibold text-data">{auc === null ? '…' : won}</span> times. Guessing would win about 50.
      </p>
    </Panel>
  )
}
