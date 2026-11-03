import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { Flagship } from '@/hooks/useHomeData'
import type { Model } from '@/science/v2/model'
import { dimScores } from '@/science/v2/screening'
import { DIMENSION_NAMES } from '@/science/v2/verdict'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { BODY } from '@/components/explorer/roles'
import { DIMENSION_CARDS } from './dimensions'

type Card = (typeof DIMENSION_CARDS)[number]

function Card({ d, model, flagships }: { d: Card; model: Model; flagships: Flagship[] }) {
  const dim = model.dimensions[d.id]
  return (
    <article className="flex h-[440px] w-[78vw] max-w-[360px] shrink-0 snap-center flex-col rounded-2xl border border-border bg-card p-6 lg:w-[360px]">
      <d.icon aria-hidden="true" className="size-7 text-data" />
      <h3 className="mt-6 text-xl font-semibold leading-snug tracking-tight">{DIMENSION_NAMES[d.id]}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{dim?.description}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">NASA data: {d.sources}</p>
      <dl className="mt-auto space-y-3 border-t border-border pt-4">
        {flagships.map((f, k) => {
          const best = f.top[0]
          const dims = best ? dimScores(best.candidate.dims) : {}
          const v = dims[d.id]
          const scored = v !== undefined && Number.isFinite(v)
          return (
            <div key={f.target.id}>
              <div className="flex items-baseline justify-between text-xs">
                <dt style={{ color: BODY[f.target.body].color }}>Best Earth place vs {f.short}</dt>
                <dd className="tabular text-base text-slate-100">{scored ? Math.round(v * 100) : <span className="text-xs text-slate-400">not scored</span>}</dd>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: BODY[f.target.body].color }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${scored ? v * 100 : 0}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: 0.2 + k * 0.1 }}
                />
              </div>
            </div>
          )
        })}
      </dl>
    </article>
  )
}

function Intro() {
  return (
    <div className="flex w-[78vw] max-w-[420px] shrink-0 snap-start flex-col justify-center lg:w-[420px]">
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">Seven characteristics, each from NASA data.</h2>
      <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
        No single place on Earth matches a planet in everything, so each one is scored separately. Bars show how the best Earth place for each target scores on it.
      </p>
      <p className="mt-6 hidden font-mono text-[11px] text-slate-400 lg:block">Keep scrolling →</p>
    </div>
  )
}

/**
 * Horizontal scroll section. On large screens it pins and turns vertical scrolling into a sideways track;
 * on phones it is a native swipe carousel with snap points.
 */
export function IndicatorTrack({ model, flagships }: { model: Model; flagships: Flagship[] }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduced = useReducedMotion()
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [dist, setDist] = useState(0)
  const { scrollYProgress } = useScroll({ target: outer, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist])
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1])

  useLayoutEffect(() => {
    const el = track.current
    if (!el || !desktop) return
    const measure = () => setDist(Math.max(0, el.scrollWidth - window.innerWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [desktop])

  const items = (
    <>
      <Intro />
      {DIMENSION_CARDS.map((d) => (
        <Card key={d.id} d={d} model={model} flagships={flagships} />
      ))}
      <div className="w-6 shrink-0 lg:w-[10vw]" aria-hidden="true" />
    </>
  )

  if (!desktop || reduced) {
    return (
      <section className="py-20" aria-label="Analog dimensions">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:px-10">{items}</div>
      </section>
    )
  }

  return (
    <section ref={outer} className="relative" style={{ height: `calc(100svh + ${dist}px)` }} aria-label="Analog dimensions">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <motion.div ref={track} style={{ x }} className="flex w-max items-center gap-6 pl-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))]">
          {items}
        </motion.div>
        <div className="mx-auto mt-10 h-px w-full max-w-6xl overflow-hidden bg-white/10 px-10">
          <motion.div className="h-full origin-left bg-data" style={{ scaleX: bar }} />
        </div>
      </div>
    </section>
  )
}
