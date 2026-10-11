import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { Layers, ListOrdered, Mountain, Radar, Scale } from 'lucide-react'
import { fadeUp } from '@/design/motion'

const STEPS = [
  {
    icon: Mountain,
    title: 'Pick a target',
    body: 'Jezero Crater on Mars (CTX elevation model) or the Mons Mouton Plateau at the lunar south pole (LOLA 20 m).',
    tone: 'var(--reference)',
  },
  {
    icon: Layers,
    title: 'Same grid, both worlds',
    body: 'Copernicus GLO-30 for Earth. Every window is cut to 20 × 20 km and resampled to the same 100 m cells.',
    tone: 'var(--data)',
  },
  {
    icon: Scale,
    title: 'Five indicators, one score',
    body: 'Slope, steep slopes, relief, ruggedness and hypsometry, computed by identical code, then compared with a weighted score you can adjust.',
    tone: 'var(--derived)',
  },
  {
    icon: ListOrdered,
    title: 'Validate against NASA',
    body: 'Does the method rank NASA-documented analogs above farmland, rainforest and glaciers? The answer is published, including the weak spots.',
    tone: 'var(--positive)',
  },
  {
    icon: Radar,
    title: 'Screen new ground',
    body: 'Hundreds of unreviewed windows across 14 dry, volcanic and polar regions, scored the same way, flagged as leads for expert review.',
    tone: 'var(--screen)',
  },
]

/** Pipeline steps with a progress rail that fills as the list scrolls through the viewport. */
export function Workflow() {
  const ref = useRef<HTMLOListElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <ol ref={ref} className="relative grid gap-4 pl-8 lg:grid-cols-5 lg:pl-0 lg:pt-10">
      {/* rail: vertical on small screens, horizontal on large */}
      <div className="absolute bottom-2 left-3 top-2 w-px bg-border lg:inset-x-0 lg:bottom-auto lg:top-3 lg:h-px lg:w-auto" aria-hidden="true" />
      <motion.div
        className="absolute left-3 top-2 h-[calc(100%-1rem)] w-px origin-top bg-gradient-to-b from-reference via-derived to-screen lg:hidden"
        style={{ scaleY: reduced ? 1 : progress }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute inset-x-0 top-3 hidden h-px origin-left bg-gradient-to-r from-reference via-derived to-screen lg:block"
        style={{ scaleX: reduced ? 1 : progress }}
        aria-hidden="true"
      />
      {STEPS.map((s, i) => (
        <motion.li key={s.title} variants={fadeUp(reduced, i * 0.04)} className="relative rounded-xl border border-border bg-card p-5 transition-colors hover:border-slate-400/40">
          <span
            className="absolute -left-[1.6rem] top-6 size-2.5 rounded-full ring-4 ring-background lg:-top-[1.95rem] lg:left-5"
            style={{ background: s.tone }}
            aria-hidden="true"
          />
          <div className="flex items-center justify-between">
            <s.icon className="size-5" style={{ color: s.tone }} />
            <span className="font-mono text-xs text-slate-400">0{i + 1}</span>
          </div>
          <h3 className="mt-5 font-semibold">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
        </motion.li>
      ))}
    </ol>
  )
}
