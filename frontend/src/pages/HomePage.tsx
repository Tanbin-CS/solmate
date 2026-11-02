import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fadeUp, stagger } from '@/design/motion'
import { useHomeData, type HomeData } from '@/hooks/useHomeData'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import { spring } from '@/design/motion'
import { BODY } from '@/components/explorer/roles'
import { CountUp } from '@/components/home/CountUp'
import { TargetShowcase } from '@/components/home/TargetShowcase'
import { WorldMap } from '@/components/home/WorldMap'
import { LiveResults } from '@/components/home/LiveResults'
import { IndicatorTrack } from '@/components/home/IndicatorTrack'
import { HowItWorks } from '@/components/home/HowItWorks'
import { ParallaxWorlds, ScrollRevealText, StackCards, TiltCard, ZoomOnScroll } from '@/components/home/ScrollFx'
import { OrbitZoom } from '@/components/home/OrbitZoom'
import { Hero } from '@/components/hero/Hero'
import facts from '@/data/site_facts.json'

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

function Stats({ data }: { data: HomeData }) {
  const reduced = useReducedMotion()
  const jezero = data.validation.targets.jezero_crater
  const moon = data.validation.summary.moon
  const items = [
    { value: data.targets.length, label: 'NASA targets', sub: '9 Artemis III regions, 2 Mars sites' },
    { value: facts.nasa_layers, label: 'NASA data layers', sub: 'MODIS, ASTER, MERRA-2, POWER, GLDAS, SRTM' },
    { value: 1.9, decimals: 1, suffix: ' M', label: 'land cells scored', sub: 'every 0.1° cell, 83° N to 83° S' },
    { value: jezero?.auc_equal ?? 0, decimals: 2, label: 'validation AUC, Jezero', sub: `Moon regions median ${moon?.auc_median.toFixed(2) ?? '–'} · 0.5 = chance` },
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
          <motion.div key={s.label} variants={fadeUp(reduced)} className="bg-card">
            <TiltCard className="h-full p-5 md:p-6">
              <p className="text-3xl font-semibold text-slate-100 md:text-4xl">
                <CountUp value={s.value} decimals={s.decimals ?? 0} />
                {s.suffix}
              </p>
              <p className="mt-2 text-sm text-slate-200">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function Section({ title, intro, children, id, aside, className }: { title: string; intro?: string; children: ReactNode; id?: string; aside?: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      id={id}
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px' }}
      className={`relative mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 md:px-10 md:py-24 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <motion.h2 variants={fadeUp(reduced)} className="max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
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

/** Mars or Moon switch shared by the three result sections. */
function FlagshipSwitch({ data, value, onChange, where }: { data: HomeData; value: string; onChange: (id: string) => void; where: string }) {
  return (
    <div role="radiogroup" aria-label="Planetary target" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-ink-950/60 p-1">
      {data.flagships.map((f) => {
        const active = f.target.id === value
        return (
          <button
            key={f.target.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f.target.id)}
            className={cn('relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors', active ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200')}
          >
            {active && <motion.span layoutId={`home-target-${where}`} transition={spring} className="absolute inset-0 rounded-lg border border-border bg-ink-700" />}
            <img src={asset(f.quicklooks.hillshade)} alt="" className="relative size-9 shrink-0 rounded-md object-cover" />
            <span className="relative min-w-0">
              <span className="block font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: BODY[f.target.body].color }}>
                {BODY[f.target.body].label}
              </span>
              <span className="block truncate text-[13px] font-medium">{f.short}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Results({ data, between }: { data: HomeData; between?: ReactNode }) {
  const [targetId, setTargetId] = useState(data.flagships[0]!.target.id)
  const flagship = data.flagships.find((f) => f.target.id === targetId) ?? data.flagships[0]!
  const others = data.targets.length - data.flagships.length
  const switcher = (where: string) => <FlagshipSwitch data={data} value={targetId} onChange={setTargetId} where={where} />

  return (
    <>
      <Section
        id="compare"
        title="Drag across two worlds at the same scale."
        intro="Each panel is a 20 km window. Pick a target, then compare it with the best places the global screen found on Earth."
        aside={switcher('compare')}
      >
        <ZoomOnScroll>
          <AnimatePresence mode="wait">
            <motion.div key={flagship.target.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
              <TargetShowcase flagship={flagship} />
            </motion.div>
          </AnimatePresence>
        </ZoomOnScroll>
      </Section>

      {between}

      <Section
        id="map"
        title={`Where Earth comes closest to ${flagship.short}.`}
        intro={`The best cells from 1.9 million on land, the novel leads far from any site tested before, and the field sites already in use. The Explorer covers the other ${others} targets.`}
        aside={switcher('map')}
      >
        <ZoomOnScroll>
          <WorldMap flagship={flagship} known={data.model.known_analogs.sites} weights={data.equal} />
        </ZoomOnScroll>
      </Section>

      <Section id="results" title="Computed from NASA data, not typed in." aside={switcher('results')}>
        <LiveResults flagship={flagship} />
      </Section>
    </>
  )
}

export default function HomePage() {
  const reduced = useReducedMotion()
  const state = useHomeData()
  const data = state.status === 'ready' ? state.data : null

  return (
    <>
      <Hero data={data} />

      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-16 md:px-10">
          <Skeleton className="h-28 w-full bg-ink-800" />
          <Skeleton className="h-96 w-full bg-ink-800" />
        </div>
      )}
      {state.status === 'error' && <p className="mx-auto max-w-6xl px-6 py-16 font-mono text-sm text-slate-400 md:px-10">Results are unavailable right now. The Explorer, method and data pages still work.</p>}

      {data && (
        <>
          <Stats data={data} />
          <OrbitZoom data={data} />
          <Results
            data={data}
            between={
              <Section id="how" title="Five steps from a NASA landing site to its Earth twins.">
                <HowItWorks data={data} />
                <div className="mx-auto mt-24 max-w-4xl text-center">
                  <ShieldCheck className="mx-auto size-6 text-positive" />
                  <ScrollRevealText
                    className="mt-6 justify-center text-balance text-2xl font-semibold leading-snug tracking-tight text-slate-100 md:text-4xl"
                    text="A high score is not proof that two places are the same. Every result shows where the analogy breaks down, where its data come from and how uncertain it is."
                  />
                  <Button asChild variant="data" size="sm" className="mt-8">
                    <Link to="/method#limitations">Read the limitations</Link>
                  </Button>
                </div>
              </Section>
            }
          />
          <IndicatorTrack model={data.model} flagships={data.flagships} />
        </>
      )}

      <Section title="Testing on Earth is cheaper than learning on another world." className="isolate">
        <ParallaxWorlds />
        <StackCards
          items={LESSONS.map((l) => (
            <article key={l.title} className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-8 shadow-2xl md:p-10">
              <TriangleAlert className="size-5 text-reference" />
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">{l.title}</h3>
              <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{l.body}</p>
            </article>
          ))}
        />
      </Section>

      <Section title="Why NASA rehearses on Earth.">
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
