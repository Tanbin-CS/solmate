import { Box } from 'lucide-react'
import type { Ranked } from '@/science/v2/screening'
import { useCountries } from '@/lib/countries'
import { placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import { siteName } from './labels'

interface Props {
  label: string
  items: Ranked[]
  noveltyKm: number
  selected: { lat: number; lon: number } | null
  onPick: (lat: number, lon: number) => void
  /** true when the place has a Twin Drive 3D block */
  has3d?: (lat: number, lon: number) => boolean
  /** row under the pointer or keyboard focus, so the map can light up its numbered marker */
  onHover?: (index: number | null) => void
}

/** Screening candidates ranked by SAI; novel = farther than noveltyKm from every known analog. */
export function CandidateList({ label, items, noveltyKm, selected, onPick, has3d, onHover }: Props) {
  const countries = useCountries()
  return (
    <ol aria-label={label} className="space-y-1" onPointerLeave={() => onHover?.(null)} onBlur={() => onHover?.(null)}>
      {items.map(({ candidate: c, sai, t100 }, i) => {
        const active = selected !== null && Math.abs(selected.lat - c.lat) < 0.051 && Math.abs(selected.lon - c.lon) < 0.051
        const novel = (c.nearest_known_km ?? 0) > noveltyKm
        const place = placeLabel(c.lat, c.lon, countries)
        const cube = has3d?.(c.lat, c.lon) ?? false
        const where = c.nearest_known ? `${Math.round(c.nearest_known_km ?? 0)} km from ${siteName(c.nearest_known)}` : 'No known analog nearby'
        return (
          <li key={`${c.lat},${c.lon}`}>
            <button
              type="button"
              onClick={() => onPick(c.lat, c.lon)}
              onPointerEnter={() => onHover?.(i)}
              onFocus={() => onHover?.(i)}
              aria-current={active || undefined}
              className={cn(
                'grid w-full grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                active ? 'border-slate-300/40 bg-ink-700' : 'border-transparent hover:bg-ink-800',
              )}
            >
              <span className="font-mono text-[11px] tabular text-slate-400">{i + 1}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] text-slate-100">
                  <span className="truncate" title={place.name}>
                    {place.name}
                  </span>
                  {cube && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-data/40 px-1 font-mono text-[9.5px] leading-4 text-data" title="Twin Drive: drive this place in 3D">
                      <Box className="size-2.5" aria-hidden />
                      3D
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] text-slate-400" title={`${place.coords}. ${novel ? 'Novel lead: ' : ''}${where}`}>
                  {place.name !== place.coords && <span className="font-mono">{place.coords} · </span>}
                  {novel && <span className="text-screen">Novel · </span>}
                  {where}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm tabular text-slate-100">{Number.isFinite(sai) ? sai.toFixed(1) : '–'}</span>
                {t100 !== null && <span className="block font-mono text-[11px] text-slate-400" title="100 m terrain check, not part of the index">100 m {Math.round(t100 * 100)}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
