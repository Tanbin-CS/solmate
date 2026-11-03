import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown } from 'lucide-react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import type { Target } from '@/science/v2/model'
import { cluesFor, mapPos, polarPos, TARGET_ABOUT } from './content'
import type { LearnData } from './data'
import { HuntRound } from './HuntRound'
import { Clues, Stars } from './parts'

const lon180 = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
/** A target's centre (targets.json passes it through unchecked, so read it carefully). */
const at = (t: Target) => {
  const c = (t as { centroid?: { lat?: unknown; lon?: unknown } }).centroid
  return { lat: num(c?.lat), lon: lon180(num(c?.lon)) }
}

/** A zoomed-in piece of the Mars map with a dot on the target. */
function MarsSpot({ t, zoom = 3 }: { t: Target; zoom?: number }) {
  const p = at(t)
  const clampPct = (v: number) => Math.min(0, Math.max(100 - zoom * 100, v))
  const left = clampPct(50 - ((p.lon + 180) / 360) * zoom * 100)
  const top = clampPct(50 - ((90 - p.lat) / 180) * zoom * 100)
  return (
    <div className="relative aspect-[2/1] overflow-hidden rounded-xl bg-ink-950" aria-hidden="true">
      <div
        className="absolute"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${zoom * 100}%`,
          height: `${zoom * 100}%`,
        }}
      >
        <img src={asset('media/mars-1k.webp')} alt="" className="h-full w-full object-fill" loading="lazy" />
        <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-mars shadow-[0_0_0_4px_rgb(0_0_0/0.35)]" style={mapPos(p)} />
      </div>
    </div>
  )
}

/** The Moon's south pole seen from below, with all nine Artemis III regions; one is highlighted. */
function MoonSpot({ t, all, labelled = false }: { t: Target; all: Target[]; labelled?: boolean }) {
  const disc = useId()
  return (
    <div className="relative aspect-[2/1] overflow-hidden rounded-xl bg-ink-950" aria-hidden="true">
      <svg viewBox="0 0 200 100" className="h-full w-full">
        <defs>
          <radialGradient id={disc} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5b5f68" />
            <stop offset="100%" stopColor="#2a2d33" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="50" r="46" fill={`url(#${disc})`} />
        {[-84, -87].map((lat) => (
          <circle key={lat} cx="100" cy="50" r={46 * (Math.cos((lat * Math.PI) / 180) / Math.cos((-81 * Math.PI) / 180))} fill="none" stroke="white" strokeOpacity="0.18" strokeDasharray="2 2" />
        ))}
        <path d="M97 50h6M100 47v6" stroke="white" strokeOpacity="0.6" />
        {all.map((x) => {
          const q = polarPos(at(x))
          const on = x.id === t.id
          return <circle key={x.id} cx={54 + q.x * 92} cy={4 + q.y * 92} r={on ? 4 : 2.2} fill={on ? 'var(--reference)' : 'white'} fillOpacity={on ? 1 : 0.45} stroke={on ? 'white' : 'none'} strokeWidth="1.2" />
        })}
        {labelled && (
          <text x="100" y="63" textAnchor="middle" fontSize="6" fill="white" fillOpacity="0.7">
            South pole
          </text>
        )}
      </svg>
    </div>
  )
}

function Spot({ t, all, labelled }: { t: Target; all: Target[]; labelled?: boolean }) {
  return t.body === 'mars' ? <MarsSpot t={t} /> : <MoonSpot t={t} all={all} labelled={labelled} />
}

/**
 * Analog Hunter: pick any of the 11 places in space, read about it, then play hot and cold on the
 * world map to find its best twin on Earth. Best stars per place are kept.
 */
export function FreePlay({ data, free, onStars }: { data: LearnData; free: Record<string, number>; onStars: (targetId: string, stars: number) => void }) {
  const reduced = useReducedMotion()
  const [target, setTarget] = useState(data.targets.find((t) => t.body === 'mars')?.id ?? data.targets[0]!.id)
  const t = data.targets.find((x) => x.id === target)!
  const [world, setWorld] = useState<'mars' | 'moon'>(t.body)
  const moon = data.targets.filter((x) => x.body === 'moon')
  const shown = data.targets.filter((x) => x.body === world)
  const total = Object.values(free).reduce((a, b) => a + b, 0)
  const pick = (id: string) => {
    setTarget(id)
    document.getElementById('hunt-mission')?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <div>
      {/* what an analog is, before anything else */}
      <div className="grid items-center gap-5 rounded-2xl border border-border bg-ink-850 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          <img src={asset('media/globe-mars.webp')} alt="" className="size-16 rounded-full sm:size-20" loading="lazy" />
          <span className="text-2xl font-semibold text-slate-400">≈</span>
          <img src={asset('media/earth-1k.webp')} alt="" className="size-16 rounded-full object-cover object-[30%_40%] sm:size-20" loading="lazy" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-100">What is an analog?</p>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-300">
            A place on Earth that is a lot like a place on the Moon or Mars: just as dry, cold, bare or rocky. Astronauts and rovers practise there before they fly. Your job: find the best one.
          </p>
        </div>
      </div>

      {/* step 1: pick a place in space */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-xl font-semibold text-slate-100">
          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-data/15 align-middle text-sm text-data">1</span>
          Pick a place in space
        </h3>
        <p className="tabular text-sm text-slate-300">
          Stars collected: <span className="text-lg font-semibold text-reference">{total}</span> of {data.targets.length * 3}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md" role="group" aria-label="Choose Mars or the Moon">
        {(['mars', 'moon'] as const).map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={world === w}
            onClick={() => setWorld(w)}
            className={cn('flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors', world === w ? 'border-data bg-data/10' : 'border-border hover:border-slate-300/40')}
          >
            <img src={asset(w === 'mars' ? 'media/globe-mars.webp' : 'media/globe-moon.webp')} alt="" className="size-10 rounded-full" loading="lazy" />
            <span>
              <span className="block text-[15px] font-semibold text-slate-100">{w === 'mars' ? 'Mars' : 'The Moon'}</span>
              <span className="block text-xs text-slate-400">{data.targets.filter((x) => x.body === w).length} places</span>
            </span>
          </button>
        ))}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((x, n) => {
          const on = x.id === target
          return (
            <motion.li key={x.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 0.04 * n }}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => pick(x.id)}
                className={cn(
                  'group flex h-full w-full items-start gap-3 rounded-2xl border-2 bg-ink-850 p-3 text-left transition-[border-color,transform] hover:-translate-y-0.5 sm:flex-col sm:items-stretch sm:gap-0',
                  on ? 'border-data' : 'border-border hover:border-data/50',
                )}
              >
                <span className="block w-28 shrink-0 sm:w-full">
                  <Spot t={x} all={moon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2 sm:mt-3">
                    <span className={cn('text-[15px] font-semibold', x.body === 'mars' ? 'text-mars' : 'text-reference')}>{x.name.replace(/ \(site [^)]+\)/, '')}</span>
                    {free[x.id] !== undefined ? <Stars n={free[x.id]!} size="size-3.5" /> : <span className="shrink-0 text-xs text-slate-500">New</span>}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-slate-300">{TARGET_ABOUT[x.id] ?? ''}</span>
                  {on && <span className="mt-2 block text-xs font-medium text-data">Playing now</span>}
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>

      {/* step 2: the mission for the chosen place */}
      <div id="hunt-mission" className="mt-10 scroll-mt-24">
        <h3 className="text-xl font-semibold text-slate-100">
          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-data/15 align-middle text-sm text-data">2</span>
          Find its twin on Earth
        </h3>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={target} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div className="mt-4 grid gap-5 rounded-2xl border border-border bg-ink-850 p-5 md:grid-cols-[minmax(0,15rem)_1fr]">
              <div>
                <Spot t={t} all={moon} labelled />
                <p className="mt-2 text-xs text-slate-400">{t.body === 'mars' ? 'Where it is on Mars' : 'Where it is near the Moon’s south pole'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-400">Your mission</p>
                <p className="mt-0.5 text-balance text-2xl font-semibold tracking-tight text-slate-100">
                  Where on Earth is most like <span className={t.body === 'mars' ? 'text-mars' : 'text-reference'}>{t.name.replace(/ \(site [^)]+\)/, '')}</span>?
                </p>
                <p className="mt-1.5 text-[15px] text-slate-300">{TARGET_ABOUT[t.id]}</p>
                <p className="mt-4 text-sm font-medium text-slate-200">Clues: what it is like there</p>
                <div className="mt-2">
                  <Clues clues={cluesFor(target)} />
                </div>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[15px] text-slate-300">
              <ArrowDown className="size-4 text-data" aria-hidden="true" /> Now tap the map. Each tap tells you if you are getting hotter or colder.
            </p>
            <div className="mt-3">
              <HuntRound round={{ target }} data={data} onScored={(s) => onStars(target, s)} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
