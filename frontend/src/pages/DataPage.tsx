import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { BODY } from '@/components/explorer/roles'
import { siteName } from '@/components/explorer2/labels'
import { loadModel, loadProvenance, loadTargets } from '@/science/v2/data'
import type { Model, Target } from '@/science/v2/model'
import { safeUrl, type Provenance } from '@/science/v2/provenance'
import { INDICATOR_LABELS } from '@/science/v2/verdict'
import { cn } from '@/lib/utils'

const REPO = 'https://github.com/Tanbin-CS/solmate'
/** Files served by NASA Earthdata (LP DAAC, GES DISC, NSIDC…) can be found by product name in Earthdata Search. */
const isEarthdata = (host: string | null) => !!host && /(^|\.)earthdata(cloud)?\.nasa\.gov$|(^|\.)nsidc\.org$/.test(host)
const earthdataSearchUrl = (product: string) => `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(product)}`

interface DataDoc {
  provenance: Provenance
  targets: Target[]
  model: Model
}

export default function DataPage() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: DataDoc }>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    Promise.all([loadProvenance(), loadTargets(), loadModel()]).then(
      ([provenance, targets, model]) => alive && setState({ status: 'ready', data: { provenance, targets, model } }),
      (error: unknown) => alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      alive = false
    }
  }, [])
  return (
    <>
      <PageHeader
        title="Where every number comes from."
        lead="Every dataset, file and target value behind the SolMate Analog Index. Scored inputs are NASA data; anything else is a labelled extra that never feeds a score."
      />
      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-5xl px-6">
          <PanelSkeleton />
        </div>
      )}
      {state.status === 'error' && <ErrorState title="Provenance could not be loaded." detail={state.error.message} onRetry={() => location.reload()} />}
      {state.status === 'ready' && <DataBody data={state.data} />}
    </>
  )
}

const TH = 'px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400'
const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`)
const num = (v: number | null) => (v === null ? '–' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toPrecision(2))

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-5 text-balance text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  )
}

function DataBody({ data }: { data: DataDoc }) {
  const { provenance: p, targets, model } = data
  const sections = [...new Set(p.datasets.map((d) => d.section))]
  const [targetId, setTargetId] = useState('jezero_crater')
  const target = targets.find((t) => t.id === targetId) ?? targets[0]!

  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-6 pb-24">
      <section aria-labelledby="datasets">
        <H2 id="datasets">Datasets</H2>
        <div className="space-y-10">
          {sections.map((sec) => {
            const extra = sec.toLowerCase().includes('non-nasa')
            return (
              <div key={sec}>
                <h3 className={cn('mb-3 text-sm font-medium', extra ? 'text-slate-400' : 'text-slate-200')}>{sec}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {p.datasets
                    .filter((d) => d.section === sec)
                    .map((d) => (
                      <article key={`${sec}-${d.name}`} className="min-w-0 rounded-xl border border-border bg-card p-5">
                        <h4 className="font-semibold leading-snug text-slate-100">{d.name}</h4>
                        {d.agency && <p className="mt-1 text-xs text-slate-400">{d.agency}</p>}
                        <dl className="mt-3 space-y-1.5 text-sm">
                          {d.detail && (
                            <div className="flex gap-2">
                              <dt className="w-16 shrink-0 text-slate-400">Detail</dt>
                              <dd className="min-w-0 break-words text-slate-300">{d.detail}</dd>
                            </div>
                          )}
                          {d.use && (
                            <div className="flex gap-2">
                              <dt className="w-16 shrink-0 text-slate-400">Used for</dt>
                              <dd className="min-w-0 break-words text-slate-200">{d.use}</dd>
                            </div>
                          )}
                          {d.terms && (
                            <div className="flex gap-2">
                              <dt className="w-16 shrink-0 text-slate-400">Terms</dt>
                              <dd className="min-w-0 break-words text-slate-300">{d.terms}</dd>
                            </div>
                          )}
                        </dl>
                      </article>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="layers">
        <H2 id="layers">The Earth stack: {p.layers.length} NASA layers</H2>
        <p className="mb-5 max-w-[62ch] text-[15px] leading-relaxed text-slate-300">
          Every layer is resampled to the same {p.grid?.res_deg ?? 0.1}° grid ({p.grid?.rows ?? 1800} × {p.grid?.cols ?? 3600} cells). Coverage is the share of land cells with
          data; the percentiles describe Earth’s land and set the scale for every score.
        </p>
        <div tabIndex={0} role="region" aria-label="Earth stack layers" className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                <th className={TH}>Layer</th>
                <th className={TH}>NASA source</th>
                <th className={cn(TH, 'text-right')}>Land coverage</th>
                <th className={cn(TH, 'text-right')}>p1 · p50 · p99</th>
              </tr>
            </thead>
            <tbody>
              {p.layers.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="px-4 py-2.5 text-slate-100">
                    {l.name ?? INDICATOR_LABELS[l.id] ?? l.id.replace(/_/g, ' ')}
                    <span className="block font-mono text-xs text-slate-400">
                      {l.id}
                      {l.units && ` · ${l.units}`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{l.source}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-slate-300">{l.land_coverage === null ? '–' : `${Math.round(l.land_coverage * 100)}%`}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs tabular text-slate-400">
                    {num(l.p1)} · {num(l.p50)} · {num(l.p99)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="raw">
        <H2 id="raw">Downloaded NASA files</H2>
        <p className="mb-5 max-w-[62ch] text-[15px] leading-relaxed text-slate-300">
          {p.raw.files} files, {gb(p.raw.bytes)} in total. Each file’s URL, size and SHA-256 checksum is recorded in{' '}
          <a href={`${REPO}/blob/main/data/manifest.v2.json`} target="_blank" rel="noreferrer" className="text-data hover:underline">
            data/manifest.v2.json
          </a>
          , so anyone can fetch the same bytes and rebuild every number. Products served by NASA Earthdata link to Earthdata Search, NASA&apos;s catalogue of the same collections.
        </p>
        <div tabIndex={0} role="region" aria-label="Downloaded NASA files" className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                <th className={TH}>Product</th>
                <th className={cn(TH, 'text-right')}>Files</th>
                <th className={cn(TH, 'text-right')}>Size</th>
                <th className={TH}>Period</th>
                <th className={TH}>Served from</th>
                <th className={TH}>Catalogue</th>
              </tr>
            </thead>
            <tbody>
              {p.raw.products.map((r) => (
                <tr key={r.product} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-slate-100">{r.product}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-slate-300">{r.files}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-slate-300">{gb(r.bytes)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.first ? (r.first === r.last ? r.first : `${r.first} to ${r.last}`) : 'climatology'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.host}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {isEarthdata(r.host) ? (
                      <a href={earthdataSearchUrl(r.product)} target="_blank" rel="noreferrer" className="text-data hover:underline">
                        Earthdata Search<span className="sr-only"> for {r.product} (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="text-slate-500">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="targets">
        <H2 id="targets">Target values</H2>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-slate-300">
            Each value is computed from NASA data or cited from the literature, with its source. The constants under “breaks down” are shown, never scored.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Target
            <select value={target.id} onChange={(e) => setTargetId(e.target.value)} className="rounded-md border border-border bg-ink-850 px-2 py-1.5 text-sm text-slate-100">
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TargetValues target={target} model={model} />
      </section>

      <section aria-labelledby="sites">
        <H2 id="sites">Validation sites</H2>
        <p className="mb-5 max-w-[62ch] text-[15px] leading-relaxed text-slate-300">
          Analog sites are places NASA and partner missions have used for field tests; controls are places with no planetary use. {model.known_analogs.sites.length} known sites also
          define what counts as a novel lead.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(p.validation_sites.positives).map(([body, sites]) => (
            <SiteList key={body} title={`${body === 'mars' ? 'Mars' : 'Moon'} analog sites (${sites.length})`} color={BODY[body as 'mars' | 'moon']?.color} items={sites.map((s) => ({ id: s.id, note: s.source }))} />
          ))}
          <SiteList title={`Controls (${p.validation_sites.controls.length})`} items={p.validation_sites.controls.map((c) => ({ id: c.id, note: c.biome }))} />
        </div>
      </section>

      <section aria-labelledby="reproduce" className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <H2 id="reproduce">Reproduce</H2>
          <pre tabIndex={0} className="overflow-x-auto rounded-xl border border-border bg-ink-950 p-5 font-mono text-xs leading-relaxed text-slate-300">
            {`git clone ${REPO}
cd solmate/analysis
uv sync
uv run python download_nasa.py   # Earthdata login
uv run pytest
uv run python -m solmate.pipeline.build_stack
uv run python -m solmate.pipeline.earth_stats
uv run python -m solmate.pipeline.target_terrain
uv run python -m solmate.pipeline.target_thermal
uv run python -m solmate.pipeline.screen_v2
uv run python -m solmate.pipeline.refine --top 60
uv run python -m solmate.pipeline.rescore
uv run python -m solmate.pipeline.validate_v2
uv run python -m solmate.pipeline.export_web --tiles`}
          </pre>
        </div>
        <div className="min-w-0 space-y-3 break-words text-sm text-slate-300 md:pt-14">
          <p>
            Results version <span className="font-mono text-slate-100">{model.model_version}</span>: a short code computed from the settings behind every score (weights,
            Earth statistics and rules). It changes whenever any setting changes, so two results with the same code came from exactly the same settings.
          </p>
          {p.generated_at && <p className="font-mono text-xs text-slate-400">Earth stack built {new Date(p.generated_at).toUTCString()}</p>}
          <a href={`${REPO}/blob/main/docs/DATA_SOURCES.md`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-data hover:underline">
            docs/DATA_SOURCES.md <ExternalLink className="size-3" />
          </a>
        </div>
      </section>
    </div>
  )
}

function TargetValues({ target, model }: { target: Target; model: Model }) {
  const scored = new Set(Object.values(model.dimensions).flatMap((d) => Object.keys(d.indicators)))
  const rows = [
    ...Object.entries(target.indicators).map(([k, v]) => ({ k, v, kind: k === 'mineral_class' ? 'class' : scored.has(k) ? 'scored' : 'context' })),
    ...Object.entries(target.breaks_down ?? {}).map(([k, v]) => ({ k, v: v as unknown, kind: 'breaks down' })),
  ]
  return (
    <div tabIndex={0} role="region" aria-label="Target values" className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-ink-850">
          <tr>
            <th className={TH}>Value</th>
            <th className={cn(TH, 'text-right')}>Target</th>
            <th className={TH}>Method</th>
            <th className={TH}>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ k, v, kind }) => {
            const e = (v ?? {}) as { value?: unknown; unit?: string; method?: string; uncertainty?: string; source?: string; doi?: string; url?: string }
            const value =
              k === 'mineral_class' && v && typeof v === 'object'
                ? Object.entries(v as Record<string, unknown>)
                    .filter(([key]) => !['source', 'doi', 'url', 'method', 'excerpt'].includes(key))
                    .map(([key, on]) => `${key.replace(/_/g, ' ')}: ${typeof on === 'boolean' ? (on ? 'yes' : 'no') : String(on)}`)
                    .join(', ')
                : typeof e.value === 'number'
                  ? `${e.value}${e.unit ? ` ${e.unit}` : ''}`
                  : '–'
            const link = e.doi ? `https://doi.org/${e.doi}` : safeUrl(e.url)
            return (
              <tr key={k} className="border-t border-border align-top">
                <td className="px-4 py-2.5 text-slate-100">
                  {INDICATOR_LABELS[k] ?? k.replace(/_/g, ' ')}
                  <span className="block font-mono text-xs text-slate-400">{kind}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular text-slate-200">{value}</td>
                <td className="px-4 py-2.5 text-xs text-slate-300">
                  {e.method ?? '–'}
                  {e.uncertainty && <span className="mt-1 block max-w-xs text-slate-400">{e.uncertainty}</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400">
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="hover:text-data hover:underline">
                      {e.source ?? link}
                    </a>
                  ) : (
                    (e.source ?? '–')
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SiteList({ title, items, color }: { title: string; items: { id: string; note?: string }[]; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium" style={{ color: color ?? 'var(--slate-300)' }}>
        {title}
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((s) => (
          <li key={s.id} className="text-slate-200">
            {siteName(s.id)}
            {s.note && <span className="block text-xs text-slate-400">{s.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
