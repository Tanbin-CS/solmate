import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Model, Target } from '@/science/v2/model'
import type { PlaceResult } from '@/science/v2/place'
import { DimensionBars } from './DimensionBars'
import { PlaceImages } from './PlaceImages'
import { VerdictCard } from './VerdictCard'

interface Props {
  result: PlaceResult
  target: Target
  model: Model
  name: string
  coords: string
  /** Called once the browser's print dialog has closed. */
  onDone: () => void
}

/**
 * A one-place report for "Print or save as PDF". It renders at the top of <body>, outside the
 * Explorer's clipped, full-screen layout, and the print stylesheet hides the app around it.
 * Printing waits for the NASA images so they appear in the PDF.
 */
export function PrintPlace({ result, target, model, name, coords, onDone }: Props) {
  useEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    window.addEventListener('afterprint', finish)
    const imgs = [...document.querySelectorAll<HTMLImageElement>('[data-print-report] img')]
    const settled = (img: HTMLImageElement) =>
      img.complete
        ? null
        : new Promise<void>((ok) => {
            img.addEventListener('load', () => ok(), { once: true })
            img.addEventListener('error', () => ok(), { once: true })
          })
    const loaded = Promise.all(imgs.map(settled))
    const timeout = new Promise((ok) => setTimeout(ok, 4000))
    void Promise.race([loaded, timeout]).then(() => {
      if (!done) window.print()
    })
    return () => window.removeEventListener('afterprint', finish)
  }, [onDone])

  const verdict = result.verdict
  const url = typeof window === 'undefined' ? '' : window.location.href
  return createPortal(
    <div data-print-report className="hidden bg-ink-950 p-8 text-slate-100 print:block">
      <header className="border-b border-border pb-4">
        <p className="label-mono">SolMate place report · vs {target.name}</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-1 font-mono text-xs text-slate-400">{coords}</p>
      </header>
      {verdict && (
        <div className="mt-6 space-y-6">
          <div>
            <p className="label-mono">SolMate Analog Index</p>
            <p className="mt-1 font-mono text-4xl font-medium tabular">
              {verdict.sai === null ? '–' : verdict.sai.toFixed(1)}
              <span className="text-base text-slate-400">/100</span>
            </p>
          </div>
          <DimensionBars verdict={verdict} model={model} />
          <PlaceImages lat={result.centre.lat} lon={result.centre.lon} targetId={target.id} />
          <VerdictCard verdict={verdict} />
        </div>
      )}
      <footer className="mt-8 border-t border-border pt-3 font-mono text-[10.5px] leading-relaxed text-slate-400">
        <p>Scored from NASA data with the same code as the website. Model version {model.model_version}. Printed {new Date().toISOString().slice(0, 10)}.</p>
        <p>
          Open this place: {url}. Every dataset and its source: https://solmate-analog.web.app/provenance. A high score marks a candidate for field review, not a proven analog.
        </p>
      </footer>
    </div>,
    document.body,
  )
}
