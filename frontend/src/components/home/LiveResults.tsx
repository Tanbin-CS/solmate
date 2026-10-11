import { useMemo } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useAnalysisData } from '@/hooks/useAnalysisData'
import { analyse, equalWeights } from '@/science/analysis'
import { Skeleton } from '@/components/ui/skeleton'
import { asset } from '@/lib/asset'
import { pct } from '@/lib/format'
import { fadeUp } from '@/design/motion'
import { ROLE } from '@/components/explorer/roles'

/** Top of the equal-weight ranking and the validation headline, read from the pipeline artifacts. */
export function LiveResults() {
  const state = useAnalysisData()
  const reduced = useReducedMotion()
  const top = useMemo(
    () => (state.status === 'ready' ? analyse(state.data.indicators, equalWeights(state.data.indicators.profile.scored)).results.slice(0, 5) : []),
    [state],
  )
  if (state.status === 'loading') return <Skeleton className="h-64 w-full bg-ink-800" />
  if (state.status === 'error') return <p className="font-mono text-sm text-slate-400">Results are unavailable right now.</p>
  const r = state.data.validation.retrieval

  return (
    <motion.div variants={fadeUp(reduced)} className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {top.map((t) => (
          <li key={t.site.id}>
            <Link to={`/explorer?site=${t.site.id}`} className="group grid grid-cols-[2.5rem_3rem_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-ink-800">
              <span className="font-mono text-xs text-slate-400">#{t.rank}</span>
              <img src={asset(t.site.quicklooks.hillshade)} alt="" className="size-12 rounded-md object-cover" loading="lazy" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-100">{t.site.name}</span>
                <span className="block truncate font-mono text-[11px]" style={{ color: ROLE[t.site.role].color }}>
                  {ROLE[t.site.role].label} · {t.site.country}
                </span>
              </span>
              <span className="flex items-center gap-2 font-mono text-lg tabular text-slate-100">
                {pct(t.score)}
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-200" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="label-mono">Method check</p>
          <p className="mt-3 font-mono text-5xl tabular text-positive">{r.auc_mars_documented.toFixed(2)}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Probability that a site NASA pairs with Mars outscores a negative control (farmland, rainforest, glacier). 0.5 would be chance.
            All five top sites are NASA-documented analogs.
          </p>
        </div>
        <div className="space-y-2 text-xs text-slate-400">
          <p>Scale-sensitive: drops to {state.data.validation.sensitivity.find((c) => c.id === 'smaller-window')?.auc_mars_documented.toFixed(2)} in a 12 km window.</p>
          <Link to="/method#validation" className="inline-flex items-center gap-1 font-mono text-data hover:underline">
            Strengths and weaknesses <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
