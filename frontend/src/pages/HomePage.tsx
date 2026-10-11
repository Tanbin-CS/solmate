import { Link } from 'react-router'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, Mountain, Layers, Scale, ListOrdered, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { fadeUp, stagger } from '@/design/motion'
import { asset } from '@/lib/asset'

const STEPS = [
  {
    icon: Mountain,
    title: 'Reference region',
    body: 'Jezero Crater, Mars. The landing site of Perseverance, described from a Mars elevation model.',
    tone: 'text-reference',
  },
  {
    icon: Layers,
    title: 'Earth elevation data',
    body: 'Copernicus GLO-30 elevation for documented analog sites and negative controls, resampled to the same 100 m grid.',
    tone: 'text-data',
  },
  {
    icon: Scale,
    title: 'Transparent similarity',
    body: 'Five terrain indicators computed with identical code on both worlds, then compared with a weighted, explainable score.',
    tone: 'text-derived',
  },
  {
    icon: ListOrdered,
    title: 'Ranked and validated',
    body: 'Candidates are ranked with uncertainty, and the method is tested on whether it separates known analogs from controls.',
    tone: 'text-positive',
  },
]

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

function Hero() {
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
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={asset('media/poster.jpg')}
            aria-hidden="true"
          >
            <source src={asset('media/hero.webm')} type="video/webm" />
            <source src={asset('media/hero.mp4')} type="video/mp4" />
          </video>
        )}
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(5_8_13/0.92)_0%,rgb(5_8_13/0.55)_45%,rgb(5_8_13/0.1)_75%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-ink-950/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-background to-transparent" />

      <motion.div
        style={{ opacity: fade }}
        variants={stagger(0.1, 0.15)}
        initial="hidden"
        animate="show"
        className="w-full max-w-6xl px-6 pb-20 md:px-10 md:pb-28"
      >
        <motion.p variants={fadeUp(reduced)} className="label-mono text-slate-300">
          NASA Space Apps Challenge 2026 · Team Northern Lights
        </motion.p>
        <motion.h1
          variants={fadeUp(reduced)}
          className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-slate-100 sm:text-5xl md:text-6xl"
        >
          Find the Earth terrain closest to Jezero Crater.
        </motion.h1>
        <motion.p variants={fadeUp(reduced)} className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
          SolMate compares a Martian landing region with Earth sites using real elevation models, ranks them with a transparent
          method, and shows exactly why each site lands where it does.
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
    </section>
  )
}

function Section({ kicker, title, children, id }: { kicker: string; title: string; children: React.ReactNode; id?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      id={id}
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px' }}
      className="mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
    >
      <motion.p variants={fadeUp(reduced)} className="label-mono">
        {kicker}
      </motion.p>
      <motion.h2 variants={fadeUp(reduced)} className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </motion.h2>
      <div className="mt-12">{children}</div>
    </motion.section>
  )
}

export default function HomePage() {
  const reduced = useReducedMotion()
  return (
    <>
      <Hero />

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

      <Section kicker="The workflow" title="One target, a small set of real datasets, one explainable method.">
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} variants={fadeUp(reduced)} className="relative rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <s.icon className={`size-5 ${s.tone}`} />
                <span className="font-mono text-xs text-slate-400">0{i + 1}</span>
              </div>
              <h3 className="mt-6 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.li>
          ))}
        </ol>
        <motion.div variants={fadeUp(reduced)} className="mt-10 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-ink-850 p-5">
          <ShieldCheck className="size-5 shrink-0 text-positive" />
          <p className="flex-1 text-sm text-slate-300">
            A similarity score is not proof that two places are the same. Every result keeps its mismatches, its data source and its
            uncertainty visible.
          </p>
          <Button asChild variant="data" size="sm">
            <Link to="/method">Read the limitations</Link>
          </Button>
        </motion.div>
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
