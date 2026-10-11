import { motion, useReducedMotion } from 'motion/react'
import type { SiteResult } from '@/science/analysis'
import type { ValidationDoc } from '@/data/schema'
import { cn } from '@/lib/utils'
import { pct } from '@/lib/format'
import { ROLE } from './roles'

interface Props {
  results: SiteResult[]
  selectedId: string | null
  hoveredId: string | null
  rankRange: ValidationDoc['weight_perturbation']['rank_range']
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export function RankList({ results, selectedId, hoveredId, rankRange, onSelect, onHover }: Props) {
  const reduced = useReducedMotion()
  return (
    <ol className="space-y-1" aria-label="Earth sites ranked by terrain similarity to Jezero Crater">
      {results.map((r) => {
        const role = ROLE[r.site.role]
        const range = rankRange[r.site.id]
        const active = r.site.id === selectedId
        return (
          <motion.li key={r.site.id} layout={!reduced} transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
            <button
              type="button"
              onClick={() => onSelect(r.site.id)}
              onMouseEnter={() => onHover(r.site.id)}
              onMouseLeave={() => onHover(null)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'group grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                active ? 'bg-ink-700' : hoveredId === r.site.id ? 'bg-ink-800' : 'hover:bg-ink-800',
              )}
            >
              <span className="font-mono text-xs tabular text-slate-400">{String(r.rank).padStart(2, '0')}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span
                    className={cn('size-2 shrink-0 rounded-full', r.site.role === 'control' && 'ring-1 ring-slate-400 ring-offset-0')}
                    style={{ background: r.site.role === 'control' ? 'transparent' : role.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-slate-100">{r.site.name}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-600">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: role.color }}
                      initial={false}
                      animate={{ width: `${r.score * 100}%` }}
                      transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                  <span className="w-20 shrink-0 truncate font-mono text-[10px] text-slate-400" title="Rank range across 1,000 random weightings (5th–95th percentile)">
                    {range ? `rank ${range.p5}–${range.p95}` : ''}
                  </span>
                </span>
              </span>
              <span className="font-mono text-sm tabular text-slate-100">{pct(r.score)}</span>
            </button>
          </motion.li>
        )
      })}
    </ol>
  )
}
