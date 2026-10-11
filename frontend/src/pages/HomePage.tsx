import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, ChevronDown, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fadeUp, stagger } from '@/design/motion'
import { asset } from '@/lib/asset'
import { pct } from '@/lib/format'
import { useAllTargets, type AllTargets } from '@/hooks/useAllTargets'
import { BODY } from '@/components/explorer/roles'
import { TargetSwitcher } from '@/components/explorer/TargetSwitcher'
import { CountUp } from '@/components/home/CountUp'
import { TargetShowcase } from '@/components/home/TargetShowcase'
import { WorldMap } from '@/components/home/WorldMap'
import { LiveResults } from '@/components/home/LiveResults'
import { IndicatorStrip } from '@/components/home/IndicatorStrip'
import { Workflow } from '@/components/home/Workflow'

const LESSONS = [
  {
    title: 'Apollo lunar dust',
    body: 'Sharp, unweathered regolith grains abraded spacesuit fabric and fouled seals during Apollo surface operations.',
  },
  {
    title: 'InSight heat probe',
    body: 'The HP3 “mole” could not penetrate the cemented Martian surface layer at the InSight landing site (2019–2021).',
  },
  {
    title: 'A few famous sites',
    body: 'Death Valley, the Atacama and Haughton Crater are valuable, but they cannot represent every target, mission or instrument.',
  },
]

function HeroMatches({ data }: { data: AllTargets }) {
  const reduced = useReducedMotion()
  return (
    <motion.div variants={stagger(0.12, 0.6)} initial="hidden" animate="show" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-80 lg:grid-cols-1">
      {data.common.targets.targets.map((t) => {
        const best = data.byId[t.id]?.analysis.results[0]
        if (!best) return null
        return (
          <motion.div key={t.id} variants={fadeUp(reduced)} className="min-w-0">
            <Link
              to={`/explorer?${new URLSearchParams({ ...(t.id !== 'jezero' && { target: t.id }) })}`}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-ink-950/60 p-2.5 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-ink-950/75"
            >
              <img src={asset(t.quicklooks.hillshade)} alt="" className="size-12 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: BODY[t.body].color }}>
                  {t.short}
                </span>
                <span className="block truncate text-[13px] text-slate-100">
                  Best Earth match: <span className="font-medium">{best.site.name}</span>
                </span>
              </span>
              <span className="text-xl tabular text-slate-100">{pct(best.score)}</span>
            </Link>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function Hero({ data }: { data: AllTargets | null }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '18%'])
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0.2])

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] items-end overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0 -z-10">
        {reduced ? (
          <img src={asset('media/poster.jpg')} alt="" className="h-full w-full object-cover" />
        ) : (
          <video className="h-full w-full object-cover" autoPlay muted loop playsInline poster={asset('media/poster.jpg')} aria-hidden="true">
            <source src={asset('media/hero.webm')} type="video/webm" />
            <source src={asset('media/hero.mp4')} type="video/mp4" />
          </video>
        )}
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(5_8_13/0.95)_15%,rgb(5_8_13/0.6)_60%,rgb(5_8_13/0.25)_100%)] md:bg-[linear-gradient(90deg,rgb(5_8_13/0.92)_0%,rgb(5_8_13/0.55)_45%,rgb(5_8_13/0.1)_75%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-ink-950/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-background to-transparent" />

      <motion.div style={{ opacity: fade }} className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 md:px-10 md:pb-24 lg:flex-row lg:items-end lg:justify-between">
        <motion.div variants={stagger(0.1, 0.15)} initial="hidden" animate="show">
          <motion.p variants={fadeUp(reduced)} className="label-mono text-slate-300">
            NASA Space Apps Challenge 2026 · Team Northern Lights
          </motion.p>
          <motion.h1
            variants={fadeUp(reduced)}
            className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-slate-100 sm:text-5xl md:text-6xl"
          >
            Find the places on Earth that look most like{' '}
            <span className="text-mars">Mars</span> and the <span className="text-slate-200 underline decoration-slate-400/50 underline-offset-8">Moon</span>.
          </motion.h1>
          <motion.p variants={fadeUp(reduced)} className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
            SolMate compares Jezero Crater and the Artemis candidate Mons Mouton Plateau with Earth terrain from real elevation models, ranks every
            site with a transparent method, and shows exactly why each one lands where it does.
          </motion.p>
          <motion.div variants={fadeUp(reduced)} className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link to="/explorer">
                Open the explorer <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-slate-100/35 bg-ink-950/40 px-6 hover:bg-ink-950/60">
              <Link to="/method">How the method works</Link>
            </Button>
          </motion.div>
        </motion.div>
        {data && <HeroMatches data={data} />}
      </motion.div>

      <motion.a
        href="#numbers"
        aria-label="Scroll to results"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: reduced ? 0 : [0, 6, 0] }}
        transition={{ opacity: { delay: 1.4 }, y: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' } }}
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-slate-400 hover:text-slate-100 md:block"
      >
        <ChevronDown className="size-6" />
      </motion.a>
    </section>
  )
}

function Stats({ data }: { data: AllTargets }) {
  const reduced = useReducedMotion()
  const first = Object.values(data.byId)[0]
  const curated = first?.analysis.results.length ?? 0
  const screened = data.common.screening?.windows.length ?? 0
  const regions = data.common.screening?.regions.length ?? 0
  const aucs = data.common.targets.targets.map((t) => t.auc_documented)
  const items = [
    { value: data.common.targets.targets.length, label: 'planetary targets', sub: 'Mars + lunar south pole' },
    { value: curated, label: 'curated Earth sites', sub: 'analogs, candidates, controls' },
    ...(screened ? [{ value: screened, label: 'screened windows', sub: `${regions} regions, unreviewed` }] : []),
    { value: Math.min(...aucs), decimals: 2, label: 'validation AUC', sub: `${new Set(aucs.map((a) => a.toFixed(2))).size === 1 ? 'both targets' : 'lowest target'} · 0.5 = chance` },
  ]
  return (
    <motion.section
      id="numbers"
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 pt-10 md:px-10"
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {items.map((s) => (
          <motion.div key={s.label} variants={fadeUp(reduced)} className="bg-card p-5 md:p-6">
            <p className="text-3xl font-semibold text-slate-100 md:text-4xl">
              <CountUp value={s.value} decimals={s.decimals ?? 0} />
            </p>
            <p className="mt-2 text-sm text-slate-200">{s.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function Section({ kicker, title, intro, children, id, aside }: { kicker: string; title: string; intro?: string; children: React.ReactNode; id?: string; aside?: React.ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      id={id}
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px' }}
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 md:px-10 md:py-24"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <motion.p variants={fadeUp(reduced)} className="label-mono">
            {kicker}
          </motion.p>
          <motion.h2 variants={fadeUp(reduced)} className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </motion.h2>
          {intro && (
            <motion.p variants={fadeUp(reduced)} className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              {intro}
            </motion.p>
          )}
        </div>
        {aside && (
          <motion.div variants={fadeUp(reduced)} className="w-full md:w-80 md:shrink-0">
            {aside}
          </motion.div>
        )}
      </div>
      <div className="mt-10 md:mt-12">{children}</div>
    </motion.section>
  )
}

function Results({ data }: { data: AllTargets }) {
  const targets = data.common.targets.targets
  const [targetId, setTargetId] = useState(targets[0]!.id)
  const target = targets.find((t) => t.id === targetId) ?? targets[0]!
  const bundle = data.byId[target.id]!
  const switcher = (where: string) => <TargetSwitcher targets={targets} value={target.id} onChange={setTargetId} pillId={`home-target-${where}`} />

  return (
    <>
      <Section
        id="compare"
        kicker="See the match"
        title="Drag across two worlds at the same scale."
        intro="Each panel is a 20 × 20 km window resampled to 100 m cells. Pick a target, then compare it with its closest Earth sites."
        aside={switcher('compare')}
      >
        <AnimatePresence mode="wait">
          <motion.div key={target.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            <TargetShowcase target={target} bundle={bundle} />
          </motion.div>
        </AnimatePresence>
      </Section>

      <Section
        id="map"
        kicker="Where the analogs are"
        title={`Every scored place on Earth, for ${target.short}.`}
        intro={
          data.common.screening
            ? 'Rings are curated sites, sized by similarity; the top three pulse. Pink dots are screened windows from 14 regions, brighter means more similar. Tap any point to open it.'
            : 'Rings are curated sites, sized by similarity; the top three pulse. Tap any point to open it.'
        }
        aside={switcher('map')}
      >
        <WorldMap targetId={target.id} results={bundle.analysis.results} screened={bundle.analysis.screened} />
      </Section>

      <Section id="results" kicker="Current ranking" title="Computed from real elevation data, not typed in." aside={switcher('results')}>
        <LiveResults target={target} bundle={bundle} />
      </Section>
    </>
  )
}

export default function HomePage() {
  const reduced = useReducedMotion()
  const state = useAllTargets()
  const data = state.status === 'ready' ? state.data : null
  const meta = data ? Object.values(data.byId)[0]?.indicators.profile.indicators : undefined

  return (
    <>
      <Hero data={data} />

      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-16 md:px-10">
          <Skeleton className="h-28 w-full bg-ink-800" />
          <Skeleton className="h-96 w-full bg-ink-800" />
        </div>
      )}
      {state.status === 'error' && <p className="mx-auto max-w-6xl px-6 py-16 font-mono text-sm text-slate-400 md:px-10">Results are unavailable right now. The method and data pages still work.</p>}

      {data && (
        <>
          <Stats data={data} />
          <Results data={data} />
        </>
      )}

      <Section kicker="The workflow" title="Two targets, open datasets, one explainable method.">
        <Workflow />
        <motion.div variants={fadeUp(reduced)} className="mt-10 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-ink-850 p-5">
          <ShieldCheck className="size-5 shrink-0 text-positive" />
          <p className="min-w-0 flex-1 basis-60 text-sm text-slate-300">
            A similarity score is not proof that two places are the same. Every result keeps its mismatches, its data source and its uncertainty
            visible.
          </p>
          <Button asChild variant="data" size="sm">
            <Link to="/method">Read the limitations</Link>
          </Button>
        </motion.div>
      </Section>

      {data && meta && (
        <Section kicker="What gets measured" title="Five terrain indicators, computed the same way on every world." intro="Absolute elevation is never compared, only the shape of the ground. Values below are measured at each target.">
          <IndicatorStrip meta={meta} targets={data.common.targets.targets} />
        </Section>
      )}

      <Section kicker="Why analogs matter" title="Testing on Earth is cheaper than learning on another world.">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {LESSONS.map((l) => (
            <motion.article key={l.title} variants={fadeUp(reduced)} className="bg-card p-7">
              <TriangleAlert className="size-5 text-reference" />
              <h3 className="mt-5 text-lg font-semibold">{l.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
            </motion.article>
          ))}
        </div>
      </Section>

      <Section kicker="Mission briefing" title="Why NASA rehearses on Earth.">
        <motion.div variants={fadeUp(reduced)} className="overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            className="aspect-video w-full"
            src="https://www.youtube-nocookie.com/embed/N0f-QkEVU7U"
            title="6 NASA Technologies to Get Humans to Mars"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </motion.div>
        <p className="mt-3 font-mono text-xs text-slate-400">Video: NASA, “6 NASA Technologies to Get Humans to Mars”.</p>
      </Section>
    </>
  )
}
