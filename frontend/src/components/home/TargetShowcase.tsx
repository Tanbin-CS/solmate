import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { explorerLink, type Flagship } from '@/hooks/useHomeData'
import { gibsWindow, placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import { spring } from '@/design/motion'
import { BODY } from '@/components/explorer/roles'
import { withTerrain100 } from '@/science/v2/screening'
import { DIMENSION_NAMES } from '@/science/v2/verdict'
import { CompareSlider } from './CompareSlider'
import { DIMENSION_CARDS } from './dimensions'

type View = 'hillshade' | 'imagery'

/**
 * Side-by-side look at a planetary target and one of its best Earth places from the global screen:
 * a drag-to-compare view of two 20 km windows plus the dimension scores behind the Analog Index.
 */
export function TargetShowcase({ flagship }: { flagship: Flagship }) {
  const top = flagship.top.slice(0, 4)
  const [picked, setPicked] = useState(0)
  const [view, setView] = useState<View>('hillshade')
  const match = top[picked] ?? top[0]
  if (!match) return null
  const c = match.candidate
  const place = placeLabel(c.lat, c.lon)
  const dims = withTerrain100(c.dims, c.terrain_100m?.score)
  const body = flagship.target.body
  const views: { id: View; label: string }[] = [
    { id: 'hillshade', label: 'Shaded relief' },
    { id: 'imagery', label: body === 'moon' ? 'Imagery · sunlight' : 'Imagery' },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-8">
      <div className="space-y-3">
        <CompareSlider
          view={view}
          left={{ label: flagship.short, sub: BODY[body].label, quicklooks: flagship.quicklooks, accent: BODY[body].color }}
          right={{
            label: place.name,
            sub: `Earth · ${place.coords}`,
            quicklooks: { hillshade: gibsWindow(c.lat, c.lon, 20, 'relief'), imagery: gibsWindow(c.lat, c.lon, 20, 'imagery') },
            accent: 'var(--screen)',
          }}
        />
        <div role="radiogroup" aria-label="View" className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              onClick={() => setView(v.id)}
              className={cn('relative h-9 rounded-full px-3.5 text-xs transition-colors', view === v.id ? 'text-ink-900' : 'border border-border text-slate-300 hover:text-slate-100')}
            >
              {view === v.id && <motion.span layoutId={`view-pill-${flagship.target.id}`} transition={spring} className="absolute inset-0 rounded-full bg-slate-100" />}
              <span className="relative">{v.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          {view === 'hillshade'
            ? `${body === 'mars' ? 'Mars: CTX elevation (USGS)' : 'Moon: LRO LOLA elevation'}. Earth: NASA ASTER GDEM shaded relief.`
            : `${body === 'mars' ? 'Mars: CTX orthomosaic' : 'Moon: average Sun visibility (bright = sunlit more often)'}. Earth: NASA Landsat WELD 1990.`}
          
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Compare with</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {top.map((r, i) => {
              const pl = placeLabel(r.candidate.lat, r.candidate.lon)
              return (
                <button
                  key={`${r.candidate.lat},${r.candidate.lon}`}
                  type="button"
                  aria-pressed={i === picked}
                  onClick={() => setPicked(i)}
                  className={cn('rounded-lg border px-3 py-2 text-left transition-colors', i === picked ? 'border-slate-300/60 bg-ink-700' : 'border-border bg-card hover:bg-ink-800')}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-slate-100">{pl.name}</span>
                    <span className="font-mono text-sm tabular text-slate-100">{Math.round(r.sai)}</span>
                  </span>
                  <span className="block truncate font-mono text-[11px] text-slate-400">
                    #{i + 1} · {pl.coords}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium text-slate-200">Dimension scores</h3>
            <p className="font-mono text-[11px] text-slate-400">
              Analog Index <span className="text-slate-100">{Math.round(match.sai)}</span>/100
            </p>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.ul key={`${c.lat},${c.lon}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-3 space-y-3">
              {DIMENSION_CARDS.filter((d) => d.id in dims).map((d, i) => {
                const v = dims[d.id]!
                const ok = Number.isFinite(v)
                return (
                  <li key={d.id}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate text-slate-300">
                        {DIMENSION_NAMES[d.id]}
                        {d.id === 'T' && c.terrain_100m?.score != null && <span className="ml-1.5 font-mono text-[11px] text-data">100 m</span>}
                      </span>
                      <span className="shrink-0 font-mono tabular text-slate-400">{ok ? Math.round(v * 100) : '–'}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: v >= 0.75 ? 'var(--positive)' : v >= 0.4 ? 'var(--reference)' : 'var(--mars)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${ok ? Math.max(3, v * 100) : 0}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </li>
                )
              })}
            </motion.ul>
          </AnimatePresence>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">Full bar = identical to the target, or as close as anywhere on Earth gets. The index is their equal-weight mean.</p>
        </div>

        <Link to={explorerLink(flagship.target.id, c.lat, c.lon)} className="inline-flex items-center gap-1.5 self-start font-mono text-sm text-data hover:underline">
          Open this place in the Explorer <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
