import { ExternalLink } from 'lucide-react'
import type { ContextLayer } from '@/science/v2/model'

/** Datasets added on event day (model.json context_layers), with their value at this place. */
export function ExtraData({ layers, values }: { layers: readonly ContextLayer[]; values: Record<string, number | null> }) {
  const rows = layers.flatMap((l) => {
    const v = values[l.id]
    return v === null || v === undefined || !Number.isFinite(v) ? [] : [{ ...l, v }]
  })
  if (!rows.length) return null
  return (
    <section>
      <h3 className="label-mono mb-1.5">More NASA data at this place</h3>
      <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-slate-300">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span>
                {r.name}
                <span className="text-slate-400">{r.role === 'scored' ? ' · scored' : ' · not scored'}</span>
              </span>
              <span className="font-mono text-[12px] tabular text-slate-100">
                {r.v.toFixed(r.digits)} {r.units}
              </span>
            </div>
            <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-data hover:underline">
              {r.source}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
