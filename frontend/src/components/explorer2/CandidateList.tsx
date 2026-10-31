import { Sparkles } from 'lucide-react'
import type { Ranked } from '@/science/v2/screening'
import { fmtCoord } from '@/lib/format'
import { cn } from '@/lib/utils'
import { siteName } from './labels'

interface Props {
  label: string
  items: Ranked[]
  noveltyKm: number
  selected: { lat: number; lon: number } | null
  onPick: (lat: number, lon: number) => void
}

/** Screening candidates ranked by SAI; novel = farther than noveltyKm from every known analog. */
export function CandidateList({ label, items, noveltyKm, selected, onPick }: Props) {
  return (
    <ol aria-label={label} className="space-y-1">
      {items.map(({ candidate: c, sai, refined }, i) => {
        const active = selected !== null && Math.abs(selected.lat - c.lat) < 0.051 && Math.abs(selected.lon - c.lon) < 0.051
        const novel = (c.nearest_known_km ?? 0) > noveltyKm
        return (
          <li key={`${c.lat},${c.lon}`}>
            <button
              type="button"
              onClick={() => onPick(c.lat, c.lon)}
              aria-current={active || undefined}
              className={cn(
                'grid w-full grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                active ? 'border-slate-300/40 bg-ink-700' : 'border-transparent hover:bg-ink-800',
              )}
            >
              <span className="font-mono text-[11px] tabular text-slate-400">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12px] text-slate-100">{fmtCoord(c.lat, c.lon)}</span>
                <span className="block truncate text-[11px] text-slate-400">
                  {novel && <Sparkles className="mr-1 inline size-3 text-screen" aria-label="Novel lead" />}
                  {c.nearest_known ? `${Math.round(c.nearest_known_km ?? 0)} km from ${siteName(c.nearest_known)}` : 'No known analog nearby'}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm tabular text-slate-100">{Number.isFinite(sai) ? sai.toFixed(1) : '–'}</span>
                <span className="block font-mono text-[10px] text-slate-400">{refined ? '100 m terrain' : '1 km terrain'}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
