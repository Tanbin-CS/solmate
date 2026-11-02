import { useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { HomeData } from '@/hooks/useHomeData'
import { asset } from '@/lib/asset'
import { gibsWindow, placeLabel } from '@/lib/places'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { withTerrain100 } from '@/science/v2/screening'
import { DIMENSION_CARDS } from './dimensions'

/**
 * Pinned zoom story: Mars from orbit → zoom into a 20 km window at Jezero Crater → its best Earth place
 * from the global screen slides in beside it → the seven dimension bars and the Analog Index.
 */
export function OrbitZoom({ data }: { data: HomeData }) {
  const reduced = useReducedMotion() ?? false
  const narrow = !useMediaQuery('(min-width: 1024px)')
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [phase, setPhase] = useState(0)
  useMotionValueEvent(p, 'change', (v) => setPhase(v < 0.3 ? 0 : v < 0.52 ? 1 : v < 0.74 ? 2 : 3))

  const f = data.flagships.find((x) => x.target.body === 'mars') ?? data.flagships[0]!
  const best = f.top[0]!
  const c0 = best.candidate
  const place = placeLabel(c0.lat, c0.lon)
  const dims = withTerrain100(c0.dims, c0.terrain_100m?.score)
  const bars = DIMENSION_CARDS.filter((d) => d.id in dims)
  const score = Math.round(best.sai)

  // stage transforms
  const g0 = narrow ? 0.92 : 0.62
  const globeScale = useTransform(p, [0.08, 0.42], [g0, reduced ? g0 : 7])
  const globeOpacity = useTransform(p, [0.3, 0.42], [1, 0])
  const winOpacity = useTransform(p, [0.3, 0.42], [0, 1])
  const split = narrow ? 0.74 : 1 // side by side must fit a phone's width
  const winScale = useTransform(p, [0.3, 0.44, 0.52, 0.66], [1.8, 1, 1, split])
  const winX = useTransform(p, [0.52, 0.66], ['0%', narrow ? '-40%' : '-54%'])
  const matchX = useTransform(p, [0.52, 0.66], ['120%', narrow ? '40%' : '54%'])
  const matchScale = useTransform(p, [0.52, 0.66], [1, split])
  const matchOpacity = useTransform(p, [0.52, 0.62], [0, 1])
  const frame = useTransform(p, [0.36, 0.5], [0, 1])
  const scoreOpacity = useTransform(p, [0.72, 0.8], [0, 1])
  const scoreY = useTransform(p, [0.72, 0.8], [30, 0])
  const progress = useTransform(p, [0, 1], [0, 1])

  const captions = [
    { h: 'Start with a real landing site.', s: 'Jezero Crater, where Perseverance landed in 2021, sits on the rim of the Isidis basin.' },
    { h: 'Zoom to the ground.', s: 'A 20 km window at 100 m resolution. Earth places are compared at the same scale.' },
    { h: `Its closest twin: the ${place.name}.`, s: `${place.coords}, found by scoring every land cell on Earth, not by picking from a list of famous sites.` },
    { h: `${score}/100 on the Analog Index.`, s: 'Terrain, climate, temperature, surface, minerals, ice and dust, each from NASA data and each open to inspection.' },
  ]
  const c = captions[phase]!

  return (
    <section ref={ref} className="relative h-[420svh]" aria-label="From orbit to an Earth twin">
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden lg:flex-row lg:items-center">
        {/* caption */}
        <div className="relative z-10 order-2 mx-auto w-full max-w-6xl px-6 pb-8 lg:order-1 lg:w-[38%] lg:max-w-none lg:pb-0 lg:pl-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))] lg:pr-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{c.h}</h2>
              <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">{c.s}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 h-px w-48 overflow-hidden bg-white/10">
            <motion.div className="h-full origin-left bg-gradient-to-r from-mars to-data" style={{ scaleX: progress }} />
          </div>
        </div>

        {/* stage */}
        <div className="relative order-1 flex flex-1 items-center justify-center pt-20 lg:order-2 lg:h-full lg:pt-0">
          <div className="relative aspect-square w-[min(78vw,46svh)] lg:w-[min(40vw,62svh)]">
            <motion.img
              src={asset('media/globe-mars.webp')}
              alt="Mars, centred on Jezero Crater"
              style={{ scale: globeScale, opacity: globeOpacity }}
              className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_60px_rgb(217_120_90/0.25)]"
              draggable={false}
            />
            {/* Jezero window */}
            <motion.figure style={{ opacity: winOpacity, scale: winScale, x: winX }} className="absolute inset-[18%] overflow-hidden rounded-lg">
              <img src={asset(f.quicklooks.imagery)} alt="Jezero Crater, 20 km window" className="h-full w-full object-cover" />
              <motion.div style={{ opacity: frame }} className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-reference" />
              <figcaption className="absolute left-2 top-2 rounded bg-ink-950/80 px-2 py-1 font-mono text-[11px] text-reference">MARS · {f.short}</figcaption>
            </motion.figure>
            {/* Earth match */}
            <motion.figure style={{ opacity: matchOpacity, x: matchX, scale: matchScale }} className="absolute inset-[18%] overflow-hidden rounded-lg border-2 border-data/70">
              <img src={gibsWindow(c0.lat, c0.lon, 20, 'imagery')} alt={`${place.name}, 20 km window of Landsat imagery`} className="h-full w-full object-cover" loading="lazy" />
              <figcaption className="absolute left-2 top-2 rounded bg-ink-950/80 px-2 py-1 font-mono text-[11px] text-data">EARTH · {place.name}</figcaption>
            </motion.figure>
            {/* score + bars */}
            <motion.div style={{ opacity: scoreOpacity, y: scoreY }} className="absolute inset-x-[4%] -bottom-[6%] rounded-xl border border-white/10 bg-ink-950/85 p-3 backdrop-blur-md lg:-bottom-[14%]">
              <div className="flex items-center justify-between">
                <span className="label-mono">Analog Index</span>
                <span className="tabular text-2xl text-slate-100">
                  {score}
                  <span className="text-sm text-slate-400">/100</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {bars.map((d) => {
                  const v = dims[d.id]!
                  return (
                    <div key={d.id} title={`${d.short}: ${Number.isFinite(v) ? Math.round(v * 100) : '–'}/100`}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-derived to-data" style={{ width: `${Number.isFinite(v) ? v * 100 : 0}%` }} />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-400">{d.short}</p>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
