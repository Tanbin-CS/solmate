import { motion, useReducedMotion } from 'motion/react'
import type { Model } from '@/science/v2/model'
import type { Verdict } from '@/science/v2/verdict'
import { cn } from '@/lib/utils'
import { BAND_STYLE } from './labels'

/** One bar per dimension: score 0-100, band, and share of the SAI. */
export function DimensionBars({ verdict, model, refined = false }: { verdict: Verdict; model: Model; refined?: boolean }) {
  const reduced = useReducedMotion()
  return (
    <ul className="space-y-2" aria-label="Dimension scores">
      {verdict.dimensions.map((d) => {
        const s = d.score
        const band = d.band
        const dim = model.dimensions[d.id]
        return (
          <li key={d.id} title={dim?.description}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="text-slate-200">
                {d.name}
                {refined && d.id === 'T' && <span className="ml-1.5 font-mono text-[10px] text-data">100 m</span>}
              </span>
              <span className="font-mono text-[11px] tabular">
                <span className="text-slate-100">{s === null ? '–' : Math.round(s * 100)}</span>
                <span className={cn('ml-2', BAND_STYLE[band].className)}>{BAND_STYLE[band].label}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-600" aria-hidden="true">
              <motion.div
                className={cn('h-full rounded-full', band === 'weak' ? 'bg-negative/80' : band === 'partial' ? 'bg-derived' : 'bg-data')}
                initial={false}
                animate={{ width: `${(s ?? 0) * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
