import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { z } from 'zod'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { asset } from '@/lib/asset'
import { ownSitePath } from '@/lib/links'

/**
 * The findings report. Content comes from data/v2/report.json, written by
 * analysis/src/solmate/pipeline/report.py together with docs/REPORT.md, so the page and
 * the document always say the same thing. Rendered as React text: no HTML from data.
 */
const Block = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['h1', 'h2', 'h3']), text: z.string() }),
  z.object({ type: z.literal('p'), text: z.string() }),
  z.object({ type: z.literal('ul'), items: z.array(z.string()) }),
  z.object({ type: z.literal('table'), head: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  z.object({ type: z.literal('figure'), images: z.array(z.object({ src: z.string().regex(/^data\/report\/[a-z0-9_-]+\.webp$/), alt: z.string(), caption: z.string() })) }),
])
const ReportSchema = z.object({ version: z.literal(1), blocks: z.array(Block) })
type Block = z.infer<typeof Block>

const URL_RE = /(https:\/\/[^\s)]+)/g

/** Plain text with https URLs as links; links to this site stay in the app. */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) => {
        if (i % 2 === 0) return part
        const path = ownSitePath(part)
        if (path) {
          return (
            <Link key={i} to={path} className="text-data hover:underline">
              {path === '/' ? 'SolMate' : path.split('?')[0]}
            </Link>
          )
        }
        return (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-data hover:underline">
            {part.replace(/^https:\/\//, '')}
          </a>
        )
      })}
    </>
  )
}

function Render({ b }: { b: Block }) {
  switch (b.type) {
    case 'h1':
      return <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">{b.text}</h1>
    case 'h2':
      return <h2 className="mt-16 text-balance border-t border-border pt-12 text-2xl font-semibold tracking-tight md:text-3xl">{b.text}</h2>
    case 'h3':
      return <h3 className="mt-8 text-lg font-semibold text-slate-100">{b.text}</h3>
    case 'p':
      return (
        <p className="max-w-[65ch] text-pretty text-[15px] leading-relaxed text-slate-300">
          <Linked text={b.text} />
        </p>
      )
    case 'ul':
      return (
        <ul className="max-w-[65ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-300 marker:text-slate-400">
          {b.items.map((it, i) => (
            <li key={i} className="text-pretty">
              <Linked text={it} />
            </li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <div tabIndex={0} role="region" aria-label={b.head.join(", ")} className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {r.map((c, j) => (
                    <td key={j} className={j === 0 ? 'px-4 py-2.5 text-slate-100' : 'px-4 py-2.5 font-mono text-[13px] tabular text-slate-300'}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'figure':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {b.images.map((im) => (
            <figure key={im.src} className="overflow-hidden rounded-xl border border-border bg-ink-900">
              <img src={asset(im.src)} alt={im.alt} loading="lazy" className="aspect-square w-full object-cover" />
              <figcaption className="px-3 py-2 font-mono text-[11px] text-slate-400">{im.caption}</figcaption>
            </figure>
          ))}
        </div>
      )
  }
}

export default function FindingsPage() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; blocks: Block[] }>({
    status: 'loading',
  })
  useEffect(() => {
    let alive = true
    fetch(asset('data/v2/report.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the report (HTTP ${r.status})`)
        return r.json()
      })
      .then((x) => ReportSchema.parse(x))
      .then(
        (doc) => alive && setState({ status: 'ready', blocks: doc.blocks }),
        (error: unknown) => alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
      )
    return () => {
      alive = false
    }
  }, [])

  return (
    <article className="mx-auto w-full max-w-4xl space-y-5 px-6 pb-24 pt-16 md:pt-24">
      {state.status === 'loading' && <PanelSkeleton />}
      {state.status === 'error' && <ErrorState title="The findings report could not be loaded." detail={state.error.message} onRetry={() => location.reload()} />}
      {state.status === 'ready' && (
        <>
          {state.blocks.map((b, i) => (
            <Render key={i} b={b} />
          ))}
          <div className="flex flex-wrap gap-3 border-t border-border pt-10">
            <Button asChild>
              <Link to="/explorer">
                Open the Explorer <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="https://github.com/Tanbin-CS/solmate/blob/main/docs/REPORT.md" target="_blank" rel="noreferrer">
                Report on GitHub
              </a>
            </Button>
          </div>
        </>
      )}
    </article>
  )
}
