import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { explorerLink, type Flagship } from '@/hooks/useHomeData'
import { asset } from '@/lib/asset'
import { useCountries } from '@/lib/countries'
import { placeLabel } from '@/lib/places'
import { siteName } from '@/components/explorer2/labels'
import { rank } from '@/science/v2/screening'

const x = (lon: number) => `${((lon + 180) / 360) * 100}%`
const y = (lat: number) => `${((90 - lat) / 180) * 100}%`

interface Point {
  key: string
  lat: number
  lon: number
  kind: 'top' | 'novel' | 'known'
  sai?: number
  rank?: number
  label: string
}

const KIND = {
  top: { color: 'var(--data)', label: 'Top analog' },
  novel: { color: 'var(--screen)', label: 'Novel lead' },
  known: { color: 'var(--slate-300)', label: 'Known analog site' },
} as const

/**
 * Lightweight world overview (no WebGL): the target's best cells from the global screen, its novel
 * leads and the field sites already used as analogs. Click a cell to score it in the Explorer.
 */
export function WorldMap({ flagship, known, weights }: { flagship: Flagship; known: { id: string; lat: number; lon: number }[]; weights: Record<string, number> }) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<Point | null>(null)
  const countries = useCountries()
  const id = flagship.target.id

  const points = useMemo<Point[]>(() => {
    const out: Point[] = known.map((k) => ({ key: `k-${k.id}`, lat: k.lat, lon: k.lon, kind: 'known', label: siteName(k.id) }))
    const seen = new Set<string>()
    const add = (list: ReturnType<typeof rank>, kind: 'top' | 'novel') =>
      list.forEach((r, i) => {
        const key = `${r.candidate.lat},${r.candidate.lon}`
        if (seen.has(key)) return
        seen.add(key)
        out.push({ key, lat: r.candidate.lat, lon: r.candidate.lon, kind, sai: r.sai, rank: i + 1, label: placeLabel(r.candidate.lat, r.candidate.lon, countries).name })
      })
    add(flagship.top, 'top')
    add(rank(flagship.screening.novel_leads, weights), 'novel')
    return out
  }, [flagship, known, weights, countries])

  const scored = points.filter((p) => p.kind !== 'known')
  const lo = Math.min(...scored.map((p) => p.sai ?? 0))
  const hi = Math.max(...scored.map((p) => p.sai ?? 0), lo + 1)
  const size = (p: Point) => (p.kind === 'known' ? 9 : 7 + 12 * (((p.sai ?? lo) - lo) / (hi - lo)))

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-ink-950">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="relative aspect-[2/1] w-full min-w-[720px]">
          <img
            src={asset('media/earth-2k.webp')}
            srcSet={`${asset('media/earth-1k.webp')} 1024w, ${asset('media/earth-2k.webp')} 2048w`}
            sizes="(min-width: 1024px) 1100px, 100vw"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70 saturate-[0.8]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(5_8_13/0.7))]" />

          {points.map((p, i) => (
            <motion.button
              key={p.key}
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: reduced ? 0 : 0.15 + (i % 40) * 0.02, type: 'spring', stiffness: 400, damping: 22 }}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              onClick={() => navigate(explorerLink(id, p.lat, p.lon))}
              aria-label={`${KIND[p.kind].label}: ${p.label}${p.sai !== undefined ? `, Analog Index ${Math.round(p.sai)}` : ''}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1"
              style={{ left: x(p.lon), top: y(p.lat) }}
            >
              <span
                className="block rounded-full border-2"
                style={{
                  width: size(p),
                  height: size(p),
                  borderColor: KIND[p.kind].color,
                  background: p.kind === 'known' ? 'rgb(5 8 13 / 0.7)' : `color-mix(in oklab, ${KIND[p.kind].color} 55%, transparent)`,
                }}
              />
            </motion.button>
          ))}

          <AnimatePresence>
            {hover && (
              <motion.div
                key={hover.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-border bg-ink-900/95 p-3 shadow-xl"
                style={{
                  left: `clamp(7rem, ${x(hover.lon)}, calc(100% - 7rem))`,
                  // flip above the point in the southern half so the card never leaves the map
                  ...(hover.lat < 0 ? { bottom: `calc(${y(-hover.lat)} + 18px)` } : { top: `calc(${y(hover.lat)} + 18px)` }),
                }}
              >
                <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: KIND[hover.kind].color }}>
                  {KIND[hover.kind].label}
                  {hover.rank !== undefined && ` · #${hover.rank}`}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-slate-100">{hover.label}</p>
                {hover.sai !== undefined ? (
                  <p className="mt-1 text-xl tabular text-slate-100">
                    {Math.round(hover.sai)}
                    <span className="text-xs text-slate-400"> /100 Analog Index</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Already used for field tests</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[11px] text-slate-400">
        {(['top', 'novel', 'known'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2" style={{ borderColor: KIND[k].color, background: k === 'known' ? undefined : KIND[k].color }} />
            {KIND[k].label}
          </span>
        ))}
        <span>· size = Analog Index · click a place to score it</span>
        <span className="md:hidden">· swipe to pan</span>
      </div>
    </div>
  )
}
