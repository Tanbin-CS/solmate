import { motion, useReducedMotion } from 'motion/react'
import type { IndicatorsDoc, TargetSummary } from '@/data/schema'
import { fmtValue } from '@/lib/format'
import { fadeUp } from '@/design/motion'
import { BODY } from '@/components/explorer/roles'

// Plain-language reading of each indicator, plus a tiny cross-section sketch of what it measures.
const PLAIN: Record<string, { hint: string; path: string }> = {
  slope_median: { hint: 'How tilted the typical ground is.', path: 'M2 30 L20 24 L38 18 L56 12 L74 6' },
  slope_p90: { hint: 'How much of the area is steep: crater walls, scarps, cones.', path: 'M2 30 L22 30 L30 6 L42 6 L50 30 L74 30' },
  local_relief: { hint: 'Height difference you meet within 1 km.', path: 'M2 28 L12 10 L22 28 L32 10 L42 28 L52 10 L62 28 L72 10' },
  ruggedness: { hint: 'How bumpy the surface is cell to cell.', path: 'M2 22 L8 16 L12 24 L18 14 L24 22 L30 12 L36 24 L42 16 L48 22 L54 14 L60 24 L66 16 L74 20' },
  hypsometric_integral: { hint: 'Where the land sits between its lowest and highest point: basin vs plateau.', path: 'M2 30 C20 30 24 8 38 8 C52 8 56 30 74 30' },
}

/** The five scored indicators, explained, with both targets' measured values side by side. */
export function IndicatorStrip({ meta, targets }: { meta: IndicatorsDoc['profile']['indicators']; targets: TargetSummary[] }) {
  const reduced = useReducedMotion()
  return (
    <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
      {meta.map((m, i) => {
        const p = PLAIN[m.id]
        return (
          <motion.article
            key={m.id}
            variants={fadeUp(reduced, i * 0.05)}
            className="group w-64 shrink-0 snap-start rounded-xl border border-border bg-card p-5 transition-colors hover:border-slate-400/40 md:w-auto"
          >
            <svg viewBox="0 0 76 36" className="h-9 w-full" aria-hidden="true">
              <motion.path
                d={p?.path ?? 'M2 30 L74 30'}
                fill="none"
                stroke="var(--data)"
                strokeWidth={1.6}
                strokeLinejoin="round"
                initial={{ pathLength: reduced ? 1 : 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: 'easeInOut' }}
              />
            </svg>
            <h3 className="mt-4 text-sm font-semibold leading-snug">{m.label}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p?.hint ?? m.description}</p>
            <dl className="mt-4 space-y-1 border-t border-border pt-3">
              {targets.map((t) => (
                <div key={t.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <dt className="truncate" style={{ color: BODY[t.body].color }}>
                    {t.short}
                  </dt>
                  <dd className="shrink-0 tabular text-slate-200">{fmtValue(t.indicators[m.id] ?? NaN, m.unit)}</dd>
                </div>
              ))}
            </dl>
          </motion.article>
        )
      })}
    </div>
  )
}
