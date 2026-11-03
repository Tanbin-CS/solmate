import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, ChevronDown, Hand } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fadeUp, spring, stagger } from '@/design/motion'
import { asset } from '@/lib/asset'
import { fmtCoord, pct } from '@/lib/format'
import { regionOf } from '@/lib/places'
import { cn } from '@/lib/utils'
import { explorerLink, type HomeData } from '@/hooks/useHomeData'
import { BODY } from '@/components/explorer/roles'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { HeroSite, HeroTarget } from './HeroScene'
import { Magnetic } from './Magnetic'
import { Narrative } from './Narrative'
import { HERO_TEXTURES } from './textures'
import facts from '@/data/site_facts.json'

const loadScene = () => import('./HeroScene')
const HeroScene = lazy(loadScene)

// On the landing page, start fetching the 3D code and its textures as soon as this module runs,
// in parallel with React's first render, instead of waiting for the hero to mount.
let GL: boolean | null = null
const hasGL = () => (GL ??= webglAvailable())
if (typeof window !== 'undefined' && window.location.pathname === import.meta.env.BASE_URL && hasGL()) {
  void loadScene()
  for (const src of HERO_TEXTURES) new Image().src = src
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

const WORD: Record<'mars' | 'moon', { text: string; className: string }> = {
  mars: { text: 'Mars', className: 'text-mars' },
  moon: { text: 'the Moon', className: 'text-slate-200' },
}

/**
 * Landing hero: a live 3D view of Earth, Mars and the Moon. Arcs link the selected planetary target to
 * its best Earth places from the global v2 screen. Drag to spin Earth; click a world to switch.
 */
export function Hero({ data }: { data: HomeData | null }) {
  const reduced = useReducedMotion() ?? false
  const navigate = useNavigate()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const sceneY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '22%'])
  const sceneFade = useTransform(scrollYProgress, [0, 0.9], [1, 0.15])
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.18])
  // fade the copy away only where it overlays the scene (landscape); on phones it sits below and must stay readable
  const wide = useMediaQuery('(min-width: 768px) and (orientation: landscape)')
  const textFade = useTransform(scrollYProgress, [0, 0.55], [1, wide && !reduced ? 0 : 1])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '-12%'])

  const [gl] = useState(hasGL)
  const [active, setActive] = useState(true)
  const [sceneReady, setSceneReady] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const heroTargets: HeroTarget[] = useMemo(
    () =>
      data
        ? data.flagships.map((f) => ({
            id: f.target.id,
            body: f.target.body,
            short: f.short,
            lat: (f.target.centroid as { lat: number }).lat,
            lon: (f.target.centroid as { lon: number }).lon,
            top: f.top.slice(0, 5).map(
              (r, i): HeroSite => ({
                id: `${r.candidate.lat},${r.candidate.lon}`,
                name: fmtCoord(r.candidate.lat, r.candidate.lon),
                lat: r.candidate.lat,
                lon: r.candidate.lon,
                score: r.sai / 100,
                rank: i + 1,
                role: 'lead',
              }),
            ),
          }))
        : [
            // worlds render before the data arrives; arcs appear once it does
            { id: 'jezero_crater', body: 'mars', short: 'Jezero Crater', lat: 18.4447, lon: 77.4508, top: [] },
            { id: 'mons_mouton_plateau', body: 'moon', short: 'Mons Mouton Plateau', lat: -84.5338, lon: 30.6556, top: [] },
          ],
    [data],
  )
  // known analog sites (field-tested by NASA and others) as faint reference dots
  const allSites = useMemo(
    () => (data?.model.known_analogs.sites ?? []).map((k) => ({ id: k.id, lat: k.lat, lon: k.lon, role: 'documented' as const })),
    [data],
  )
  // every flagship's top cells and novel leads: the places the screen surfaced
  const screened = useMemo(() => {
    const seen = new Map<string, { lat: number; lon: number }>()
    for (const f of data?.flagships ?? []) for (const c of [...f.screening.top, ...f.screening.novel_leads]) seen.set(`${c.lat},${c.lon}`, { lat: c.lat, lon: c.lon })
    return [...seen.values()]
  }, [data])

  const [selected, setSelected] = useState('jezero_crater')
  const target = heroTargets.find((t) => t.id === selected) ?? heroTargets[0]!

  // gently alternate targets until the visitor takes over
  useEffect(() => {
    if (interacted || reduced || !data || !active) return
    const id = setInterval(() => {
      setSelected((cur) => {
        const i = heroTargets.findIndex((t) => t.id === cur)
        return heroTargets[(i + 1) % heroTargets.length]!.id
      })
    }, 9000)
    return () => clearInterval(id)
  }, [interacted, reduced, data, active, heroTargets])

  // stop rendering the 3D scene when the hero is off screen
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setActive(!!e?.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const choose = (id: string) => {
    setInteracted(true)
    setSelected(id)
  }
  const openSite = (targetId: string, siteId: string) => {
    const [lat, lon] = siteId.split(',').map(Number)
    navigate(explorerLink(targetId, lat, lon))
  }
  const auc = data?.flagships.find((f) => f.target.id === target.id)?.validation.auc_equal
  const best = target.top[0]

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink-950">
      {/* deep-space backdrop that shows instantly, before WebGL loads */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_70%_45%,rgb(40_80_110/0.35),transparent_55%),radial-gradient(ellipse_at_90%_15%,rgb(217_120_90/0.12),transparent_40%)]" />

      {/* placeholder glow where Earth will appear, until the 3D scene and textures are ready */}
      {gl && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: sceneReady ? 0 : 1 }}
          transition={{ duration: sceneReady ? 1.2 : 0.6 }}
          className="pointer-events-none absolute left-1/2 top-[24svh] -z-10 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(127_216_230/0.35),rgb(127_216_230/0.06)_55%,transparent_70%)] blur-sm md:landscape:left-[68%] md:landscape:top-1/2 md:landscape:size-80"
        >
          <span className="absolute inset-0 animate-ping rounded-full border border-data/20 [animation-duration:2.4s]" />
        </motion.div>
      )}

      <motion.div style={{ y: sceneY, opacity: sceneFade, scale: sceneScale }} className="absolute inset-0 -z-10 origin-[70%_40%]">
        {gl ? (
          (
            <Suspense fallback={null}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: sceneReady ? 1 : 0 }} transition={{ duration: 0.5 }} className="absolute inset-0">
                <HeroScene
                  targets={heroTargets}
                  allSites={allSites}
                  screened={screened}
                  selected={target.id}
                  hovered={hovered}
                  onSelect={choose}
                  onHoverSite={setHovered}
                  onOpenSite={openSite}
                  onInteract={() => setInteracted(true)}
                  onReady={() => setSceneReady(true)}
                  reduced={reduced}
                  active={active}
                />
              </motion.div>
            </Suspense>
          )
        ) : (
          <img src={asset('media/poster.jpg')} alt="" className="h-full w-full object-cover opacity-60" />
        )}
      </motion.div>

      {/* legibility scrims; never block the canvas */}
      <div className="pointer-events-none absolute inset-0 -z-[5] bg-[linear-gradient(0deg,rgb(5_8_13/0.96)_8%,rgb(5_8_13/0.55)_42%,transparent_70%)] md:landscape:bg-[linear-gradient(90deg,rgb(5_8_13/0.9)_0%,rgb(5_8_13/0.5)_32%,transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-[5] h-32 bg-gradient-to-t from-background to-transparent" />

      <motion.div
        style={{ y: textY, opacity: textFade }}
        className="pointer-events-none relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end gap-8 px-6 pb-14 pt-[52svh] md:px-10 md:pb-20 md:landscape:justify-center md:landscape:pt-28"
      >
        <motion.div variants={stagger(0.11, 0.35)} initial="hidden" animate="show" className="max-w-xl">
          <motion.h1 variants={fadeUp(reduced)} className="text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">
            Where on Earth looks like{' '}
            <span className="relative inline-block">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={target.body}
                  initial={{ opacity: 0, y: reduced ? 0 : '0.35em', filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: reduced ? 0 : '-0.35em', filter: 'blur(8px)' }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('inline-block', WORD[target.body].className)}
                >
                  {WORD[target.body].text}?
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>
          <motion.p variants={fadeUp(reduced)} className="mt-5 max-w-md text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
            We score every place on Earth against NASA’s Moon base regions and Mars sites, using {facts.nasa_layers} NASA data layers, to find where
            crews and rovers can rehearse.
          </motion.p>
          <motion.div variants={fadeUp(reduced)} className="pointer-events-auto mt-8 flex flex-wrap gap-3">
            <Magnetic>
              <Button asChild size="lg" className="rounded-full px-6 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)]">
                <Link to={explorerLink(target.id)}>
                  Explore the matches <ArrowRight />
                </Link>
              </Button>
            </Magnetic>
            <Magnetic>
              <Button asChild size="lg" variant="outline" className="rounded-full border-slate-100/30 bg-ink-950/40 px-6 backdrop-blur hover:bg-ink-950/60">
                <a href="#how">How it works</a>
              </Button>
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* live analog links, synced with the 3D arcs. Landscape: a slim dock under the globe so Earth stays fully visible. */}
        <motion.aside
          initial={{ opacity: 0, y: reduced ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.9, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto w-full max-w-sm self-start rounded-2xl border border-white/10 bg-ink-950/65 p-3 shadow-2xl backdrop-blur-md md:landscape:absolute md:landscape:bottom-7 md:landscape:right-[min(2rem,calc(2rem-(100vw-80rem)/2))] md:landscape:flex md:landscape:w-[min(860px,58vw)] md:landscape:max-w-none md:landscape:flex-wrap md:landscape:items-stretch md:landscape:gap-x-3 md:landscape:gap-y-1 md:landscape:self-auto md:landscape:p-2.5"
          aria-label="Best Earth matches"
        >
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/10 px-1.5 pb-2 md:landscape:mb-0 md:landscape:basis-full">
            <Narrative
              body={target.body}
              place={target.short}
              best={best && { region: regionOf(best.lat, best.lon), coords: best.name, score: best.score }}
              reduced={reduced}
            />
            {gl && (
              <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-slate-400 lg:inline-flex">
                <Hand className="size-3.5" /> drag Earth · click a planet
              </span>
            )}
          </div>
          <div
            role="radiogroup"
            aria-label="Planetary target"
            className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 md:landscape:w-52 md:landscape:shrink-0 md:landscape:grid-cols-1 md:landscape:content-center"
          >
            {heroTargets.map((t) => {
              const on = t.id === target.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(t.id)}
                  className={cn('relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors', on ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200')}
                >
                  {on && <motion.span layoutId="hero-target-pill" transition={spring} className="absolute inset-0 rounded-lg bg-white/10" />}
                  <img src={asset(t.body === 'mars' ? 'media/mars-1k.webp' : 'media/moon-1k.webp')} alt="" className="relative size-7 rounded-full object-cover object-[60%_50%]" />
                  <span className="relative min-w-0">
                    <span className="block font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: BODY[t.body].color }}>
                      {BODY[t.body].label}
                    </span>
                    <span className="block truncate text-[12px] font-medium">{t.short}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="hidden min-w-0 sm:block md:landscape:flex md:landscape:flex-1 md:landscape:flex-col">
            <p className="label-mono mt-3 flex justify-between gap-2 px-1.5 md:landscape:mt-0.5">
              <span>Closest places on Earth · Analog Index /100</span>
              {auc !== undefined && (
                <span className="hidden normal-case tracking-normal md:landscape:inline">
                  validation AUC <span className="text-positive">{auc.toFixed(2)}</span>
                </span>
              )}
            </p>
            <ol
              className="mt-1.5 space-y-0.5 md:landscape:grid md:landscape:flex-1 md:landscape:grid-cols-5 md:landscape:gap-1 md:landscape:space-y-0"
              onMouseLeave={() => setHovered(null)}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {target.top.length === 0 &&
                  Array.from({ length: 5 }, (_, i) => (
                    <li key={`sk${i}`} className="mx-1.5 my-2 h-5 animate-pulse rounded bg-white/5 md:landscape:m-0 md:landscape:h-auto" />
                  ))}
                {target.top.map((s, i) => (
                  <motion.li
                    key={`${target.id}-${s.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="min-w-0"
                  >
                    <button
                      type="button"
                      title={`${regionOf(s.lat, s.lon) ?? 'Earth'} · ${s.name} · ${pct(s.score)}/100`}
                      onMouseEnter={() => setHovered(s.id)}
                      onFocus={() => setHovered(s.id)}
                      onBlur={() => setHovered(null)}
                      onClick={() => openSite(target.id, s.id)}
                      className={cn(
                        'grid w-full grid-cols-[1.25rem_1fr_auto] items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors md:landscape:flex md:landscape:h-full md:landscape:flex-col md:landscape:items-stretch md:landscape:gap-1 md:landscape:px-2 md:landscape:py-2',
                        hovered === s.id ? 'bg-white/10' : 'hover:bg-white/5 md:landscape:bg-white/[0.03]',
                      )}
                    >
                      <span className="font-mono text-[11px] text-slate-400 md:landscape:flex md:landscape:items-baseline md:landscape:justify-between">
                        <span>
                          <span className="hidden md:landscape:inline">#</span>
                          {s.rank}
                        </span>
                        <span className="hidden font-sans text-base tabular text-slate-100 md:landscape:inline">{pct(s.score)}</span>
                      </span>
                      <span className="min-w-0 md:landscape:flex md:landscape:flex-1 md:landscape:flex-col md:landscape:justify-between md:landscape:gap-1.5">
                        <span className="block truncate text-[13px] text-slate-100 md:landscape:line-clamp-2 md:landscape:whitespace-normal md:landscape:text-[12px] md:landscape:leading-tight">
                          {s.name}
                        </span>
                        <span className="block h-1 overflow-hidden rounded-full bg-white/10">
                          <motion.span
                            className="block h-full rounded-full"
                            style={{ background: 'var(--screen)' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${s.score * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </span>
                      </span>
                      <span className="text-sm tabular text-slate-100 md:landscape:hidden">{pct(s.score)}</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
            <p className="mt-2 border-t border-white/10 px-1.5 pt-2 font-mono text-[11px] leading-relaxed text-slate-400 md:landscape:hidden">
              SolMate Analog Index /100 from {facts.nasa_layers} NASA layers
              {auc !== undefined && (
                <>
                  {' '}
                  · validation AUC <span className="text-positive">{auc.toFixed(2)}</span>
                </>
              )}
            </p>
          </div>
        </motion.aside>
      </motion.div>

      <motion.a
        href="#numbers"
        aria-label="Scroll to results"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: reduced ? 0 : [0, 6, 0] }}
        transition={{ opacity: { delay: 2.2 }, y: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' } }}
        className="absolute bottom-4 left-8 hidden text-slate-400 hover:text-slate-100 md:landscape:block"
      >
        <ChevronDown className="size-6" />
      </motion.a>
    </section>
  )
}
