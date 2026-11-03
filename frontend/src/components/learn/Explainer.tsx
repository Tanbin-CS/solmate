import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { ArrowRight, Pause, Play, RotateCcw } from 'lucide-react'
import { DIMENSION_CARDS } from '@/components/home/dimensions'
import { Button } from '@/components/ui/button'
import facts from '@/data/site_facts.json'
import { usePlaceScore } from '@/hooks/useV2'
import { asset } from '@/lib/asset'
import { gibsWindow } from '@/lib/places'
import { cn } from '@/lib/utils'
import type { LearnData } from './data'
import { LENGTH, SCENES, sceneAt, TIBET, type Numbers } from './scenes'

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const out = (x: number) => 1 - (1 - clamp(x)) ** 3 // ease out
const span = (p: number, a: number, b: number) => out((p - a) / (b - a)) // 0..1 between a and b
const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, '0')}`

/**
 * A 30-second animated explainer. Every frame is a pure function of the time t, so play, pause,
 * scrubbing and chapter jumps all show exactly the same picture. The numbers are live: the analog
 * count comes from model.json, the layer count from site_facts.json and the Tibet score is
 * computed in the browser, like everywhere else on the site.
 */
export function Explainer({ data, onStart, onFree }: { data: LearnData | null; onStart: () => void; onFree: () => void }) {
  const reduced = useReducedMotion()
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const touched = useRef(false)
  const box = useRef<HTMLDivElement>(null)
  const state = usePlaceScore(TIBET, null, 'jezero_crater', data?.model.presets.equal ?? null)
  const nums: Numbers = { analogs: data?.model.known_analogs.sites.length ?? null, sai: state?.status === 'ready' ? (state.data.verdict?.sai ?? null) : null }

  // The clock: advances t while playing and stops at the end.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((x) => {
        const next = x + dt
        if (next >= LENGTH) {
          setPlaying(false)
          return LENGTH
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // Fetch every picture up front so no scene starts on an empty frame.
  useEffect(() => {
    for (const src of [asset('media/globe-moon.webp'), asset('media/globe-mars.webp'), asset('data/quicklooks/jezero-hillshade.webp'), asset('media/earth-2k.webp'), gibsWindow(TIBET.lat, TIBET.lon, 40, 'imagery', 512)]) new Image().src = src
  }, [])

  // Start once when half of it is on screen (not with reduced motion); pause when it leaves.
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return
        if (e.isIntersecting && !touched.current && !reduced) {
          touched.current = true
          setPlaying(true)
        }
        if (!e.isIntersecting) setPlaying(false)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const i = sceneAt(t)
  const scene = SCENES[i]!
  const p = (t - scene.start) / (scene.end - scene.start)
  const ended = t >= LENGTH
  const toggle = () => {
    touched.current = true
    if (ended) setT(0)
    setPlaying((x) => (ended ? true : !x))
  }
  const seek = (s: number) => {
    touched.current = true
    setT(clamp(s, 0, LENGTH))
  }

  return (
    <figure ref={box} className="overflow-hidden rounded-2xl border border-border bg-ink-850" aria-label="30-second explainer: how SolMate finds Earth analogs">
      <div
        className="relative aspect-video w-full overflow-hidden bg-ink-950"
        onClick={toggle}
        aria-hidden="true" // the captions below carry the story for screen readers
      >
        <Stage i={i} p={p} nums={nums} sites={data?.model.known_analogs.sites ?? []} />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-950/60">
          <div className="h-full bg-data" style={{ width: `${(t / LENGTH) * 100}%` }} />
        </div>
      </div>

      <figcaption className="border-t border-border p-4 sm:p-5">
        <p className="min-h-[3.25rem] text-pretty text-[16px] leading-relaxed text-slate-100 sm:text-[17px]" aria-live="polite">
          {scene.caption(nums)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={toggle} aria-label={ended ? 'Play again' : playing ? 'Pause' : 'Play'}>
            {ended ? <RotateCcw /> : playing ? <Pause /> : <Play />}
          </Button>
          <input
            type="range"
            min={0}
            max={LENGTH}
            step={0.1}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position in the explainer"
            aria-valuetext={`${Math.floor(t)} seconds of ${LENGTH}: ${scene.chapter}`}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--data)]"
          />
          <span className="tabular w-20 shrink-0 text-right text-sm text-slate-400">
            {fmt(t)} / {fmt(LENGTH)}
          </span>
        </div>
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Chapters">
          {SCENES.map((s, n) => (
            <li key={s.chapter}>
              <button
                type="button"
                onClick={() => seek(s.start)}
                aria-current={n === i ? 'true' : undefined}
                className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors', n === i ? 'border-data/60 bg-data/10 text-data' : 'border-border text-slate-300 hover:text-slate-100')}
              >
                <span className="tabular text-slate-400">{fmt(s.start)}</span> {s.chapter}
              </button>
            </li>
          ))}
        </ol>
        {i === SCENES.length - 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onStart}>
              Start level 1 <ArrowRight />
            </Button>
            <Button variant="outline" onClick={onFree}>
              Play Analog Hunter
            </Button>
          </div>
        )}
      </figcaption>
    </figure>
  )
}

function Label({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn('absolute rounded bg-ink-950/85 px-2 py-1 text-[11px] text-slate-100 sm:text-sm', className)} style={style}>
      {children}
    </span>
  )
}

/** The picture for scene i at progress p (0..1). */
function Stage({ i, p, nums, sites }: { i: number; p: number; nums: Numbers; sites: { id: string; lat: number; lon: number }[] }) {
  const fadeIn = span(p, 0, 0.12)
  const fadeOut = 1 - span(p, 0.9, 1)
  const o = i === SCENES.length - 1 ? fadeIn : Math.min(fadeIn, fadeOut)
  switch (i) {
    case 0: {
      const ring = span(p, 0.35, 0.6)
      const zoom = span(p, 0, 1)
      return (
        <div className="absolute inset-0" style={{ opacity: o }}>
          {/* image and markers share one square box, so the markers stay on the pole while it zooms */}
          <div className="absolute inset-y-0 left-1/2 aspect-square h-full" style={{ transform: `translateX(-50%) scale(${1 + 0.35 * zoom}) translateY(${-16 * zoom}%)` }}>
            <img src={asset('media/globe-moon.webp')} alt="" className="absolute inset-0 h-full w-full object-contain" />
            <span className="absolute left-1/2 top-[86%] size-[16%] rounded-full border-2 border-reference" style={{ opacity: ring, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * ring})` }} />
            {Array.from({ length: 9 }, (_, n) => {
              const a = (n / 9) * Math.PI * 2
              return (
                <span
                  key={n}
                  className="absolute size-[1.6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-reference"
                  style={{ left: `${50 + Math.cos(a) * 4.5}%`, top: `${86 + Math.sin(a) * 4.5}%`, opacity: span(p, 0.5 + n * 0.03, 0.6 + n * 0.03) }}
                />
              )
            })}
          </div>
          <Label className="left-1/2 top-[8%] -translate-x-1/2 text-reference" style={{ opacity: span(p, 0.55, 0.75) }}>
            Nine Artemis III regions around the south pole
          </Label>
        </div>
      )
    }
    case 1: {
      const swap = span(p, 0.45, 0.65)
      return (
        <div className="absolute inset-0" style={{ opacity: o }}>
          <img src={asset('media/globe-mars.webp')} alt="" className="absolute inset-0 m-auto h-full object-contain" style={{ opacity: 1 - swap, transform: `scale(${1 + 0.5 * span(p, 0, 0.6)})` }} />
          <img src={asset('data/quicklooks/jezero-hillshade.webp')} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: swap, transform: `scale(${1.15 - 0.15 * span(p, 0.45, 1)})` }} />
          <Label className="left-4 top-4 text-mars" style={{ opacity: span(p, 0.6, 0.75) }}>
            Jezero Crater, Mars
          </Label>
        </div>
      )
    }
    case 2: {
      return (
        <div className="absolute inset-0" style={{ opacity: o }}>
          <img src={asset('media/earth-2k.webp')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          {sites.map((s, n) => (
            <span
              key={s.id}
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-reference bg-reference/40 sm:size-3"
              style={{ left: `${((s.lon + 180) / 360) * 100}%`, top: `${((90 - s.lat) / 180) * 100}%`, opacity: span(p, 0.1 + (n / sites.length) * 0.6, 0.15 + (n / sites.length) * 0.6) }}
            />
          ))}
          <Label className="bottom-4 left-4" style={{ opacity: span(p, 0.5, 0.7) }}>
            <span className="tabular text-reference">{nums.analogs ?? '…'}</span> analog places in use today
          </Label>
        </div>
      )
    }
    case 3: {
      const x = span(p, 0.05, 0.8) * 100
      const lit = Math.floor(span(p, 0.1, 0.85) * DIMENSION_CARDS.length + 0.001)
      return (
        <div className="absolute inset-0" style={{ opacity: o }}>
          <img src={asset('media/earth-2k.webp')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 saturate-50" />
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${x}%`,
              backgroundImage: 'linear-gradient(rgb(127 216 230 / 0.3) 1px, transparent 1px), linear-gradient(90deg, rgb(127 216 230 / 0.3) 1px, transparent 1px)',
              backgroundSize: '1.25% 2.5%',
            }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-data shadow-[0_0_18px_4px_rgb(127_216_230/0.6)]" style={{ left: `${x}%` }} />
          <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1 sm:inset-x-4 sm:top-4 sm:gap-1.5">
            {DIMENSION_CARDS.map((d, n) => (
              <span key={d.id} className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-xs', n < lit ? 'border-data/60 bg-ink-950/90 text-data' : 'border-border bg-ink-950/70 text-slate-500')}>
                <d.icon className="size-3 sm:size-3.5" />
                {d.short}
              </span>
            ))}
          </div>
          <Label className="bottom-4 left-4">
            <span className="tabular text-data">{Math.round(span(p, 0.1, 0.85) * 1.9 * 10) / 10}</span> million squares ·{' '}
            <span className="tabular text-data">{Math.round(span(p, 0.1, 0.6) * facts.nasa_layers)}</span> NASA layers
          </Label>
        </div>
      )
    }
    case 4: {
      const count = nums.sai === null ? null : Math.round(nums.sai * span(p, 0.2, 0.7))
      return (
        <div className="absolute inset-0 grid grid-cols-2 gap-px bg-ink-950" style={{ opacity: o }}>
          <div className="relative overflow-hidden">
            <img src={gibsWindow(TIBET.lat, TIBET.lon, 40, 'imagery', 512)} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ transform: `scale(${1.1 - 0.1 * span(p, 0, 1)})` }} />
            <Label className="left-3 top-3 text-data">Earth: Tibetan Plateau</Label>
          </div>
          <div className="relative overflow-hidden">
            <img src={asset('data/quicklooks/jezero-hillshade.webp')} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ transform: `scale(${1.1 - 0.1 * span(p, 0, 1)})` }} />
            <Label className="left-3 top-3 text-mars">Mars: Jezero Crater</Label>
          </div>
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-data/40 bg-ink-950/90 px-5 py-3 sm:px-8 sm:py-5" style={{ opacity: span(p, 0.15, 0.3) }}>
            <span className="tabular text-4xl font-semibold text-slate-100 sm:text-6xl">{count ?? '…'}</span>
            <span className="text-[11px] text-slate-400 sm:text-sm">out of 100</span>
          </div>
        </div>
      )
    }
    default:
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ opacity: o }}>
          <img src={asset('media/earth-2k.webp')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <p className="relative text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-5xl" style={{ transform: `translateY(${(1 - span(p, 0, 0.3)) * 16}px)` }}>
            Your turn.
          </p>
          <p className="relative text-balance text-sm text-slate-300 sm:text-xl" style={{ opacity: span(p, 0.2, 0.45) }}>
            Six levels. Eleven targets. Real NASA data.
          </p>
        </div>
      )
  }
}
