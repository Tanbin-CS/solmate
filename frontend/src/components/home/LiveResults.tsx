import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { explorerLink, type Flagship } from '@/hooks/useHomeData'
import { useCountries } from '@/lib/countries'
import { GibsImage } from '@/components/common/GibsImage'
import { placeLabel } from '@/lib/places'
import { CountUp } from './CountUp'

/** Top of the equal-weight ranking and the validation headline for one target, read from the v2 files. */
export function LiveResults({ flagship }: { flagship: Flagship }) {
  const top = flagship.top.slice(0, 5)
  const countries = useCountries()
  const v = flagship.validation
  const id = flagship.target.id
  const novelKm = flagship.screening.novelty_km
  const novelInTop = top.filter((r) => (r.candidate.nearest_known_km ?? 0) > novelKm).length

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {top.map((r, i) => {
          const c = r.candidate
          const pl = placeLabel(c.lat, c.lon, countries)
          const novel = (c.nearest_known_km ?? 0) > novelKm
          return (
            <motion.li key={`${id}-${c.lat},${c.lon}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}>
              <Link to={explorerLink(id, c.lat, c.lon)} className="group grid grid-cols-[2rem_3rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800 sm:grid-cols-[2.5rem_3rem_1fr_auto] sm:gap-4">
                <span className="font-mono text-xs text-slate-400">#{i + 1}</span>
                <GibsImage lat={c.lat} lon={c.lon} km={20} kind="relief" px={96} alt="" className="size-12 rounded-md bg-ink-700" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-100">{pl.name}</span>
                  <span className="block truncate font-mono text-[11px] text-slate-400">
                    {pl.coords}
                    {novel ? <span className="text-screen"> · novel lead</span> : c.nearest_known && ` · ${Math.round(c.nearest_known_km ?? 0)} km from a known site`}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-lg tabular text-slate-100">
                  {Math.round(r.sai)}
                  <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-200" />
                </span>
              </Link>
            </motion.li>
          )
        })}
      </ol>
      <div className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Method check · {flagship.short}</h3>
          <p className="mt-3 text-5xl text-positive">
            <CountUp key={id} value={v.auc_equal} decimals={2} />
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            AUC · 95% CI {v.auc_ci95[0].toFixed(2)}–{v.auc_ci95[1].toFixed(2)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Chance that one of {v.n_positives} sites NASA has used as {flagship.target.body === 'mars' ? 'Mars' : 'Moon'} analogs outscores one of {v.n_controls} controls (farmland, forest,
            cities, ice). 0.5 would be chance. {novelInTop} of the top five are more than {novelKm} km from any known analog site.
          </p>
        </div>
        <Link to="/method#validation" className="inline-flex items-center gap-1 font-mono text-xs text-data hover:underline">
          Strengths and weaknesses <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
