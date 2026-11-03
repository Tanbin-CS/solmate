import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Crosshair, Loader2, MapPin, RotateCcw, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { asset } from '@/lib/asset'
import { gibsWindow, placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import type { PlaceResult } from '@/science/v2/place'
import { score } from '@/science/v2/scorer'
import type { Verdict } from '@/science/v2/verdict'
import { distanceKm, huntStars, mapToLatLon, type Place, type Round } from './content'
import { bestFor, type LearnData } from './data'

type LatLon = { lat: number; lon: number }

const px = (lon: number) => `${((lon + 180) / 360) * 100}%`
const py = (lat: number) => `${((90 - lat) / 180) * 100}%`

export function Stars({ n, size = 'size-5', label = true }: { n: number; size?: string; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? 'img' : undefined} aria-label={label ? `${n} of 3 stars` : undefined} aria-hidden={label ? undefined : true}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={cn(size, i < n ? 'fill-reference text-reference' : 'text-ink-500')} />
      ))}
    </span>
  )
}

function bodyLabel(data: LearnData, id: string) {
  const t = data.targets.find((x) => x.id === id)
  return { name: t?.name ?? id, body: t?.body === 'mars' ? 'Mars' : 'Moon' }
}

/** Strongest and weakest characteristic of a verdict, in words. */
function strengths(v: Verdict | null): { best?: string; worst?: string } {
  const dims = (v?.dimensions ?? []).filter((d) => d.score !== null)
  if (!dims.length) return {}
  const sorted = [...dims].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return { best: sorted[0]!.name.toLowerCase(), worst: sorted[sorted.length - 1]!.name.toLowerCase() }
}

/** Plays a list of rounds; reports the stars of each round as it ends. */
export function Hunter({ rounds, data, stars, onRound, onAllDone }: { rounds: Round[]; data: LearnData; stars: number[]; onRound: (i: number, stars: number) => void; onAllDone?: () => void }) {
  const [i, setI] = useState(() => Math.min(stars.length, rounds.length - 1))
  const round = rounds[i]!
  const t = bodyLabel(data, round.target)
  const finished = stars.length >= rounds.length
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tabular text-sm text-slate-400">
            Round {i + 1} of {rounds.length} · {round.kind === 'hunt' ? 'Hunt' : 'Pick one'}
          </p>
          <h3 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-slate-100">
            Find Earth’s match for {t.name} <span className={t.body === 'Mars' ? 'text-mars' : 'text-reference'}>({t.body})</span>
          </h3>
        </div>
        <ol className="flex gap-1.5" aria-label="Rounds">
          {rounds.map((r, n) => (
            <li key={r.target}>
              <button
                type="button"
                onClick={() => setI(n)}
                disabled={n > stars.length}
                aria-current={n === i ? 'step' : undefined}
                aria-label={`Round ${n + 1}${stars[n] !== undefined ? `, ${stars[n]} stars` : ''}`}
                className={cn(
                  'flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs tabular transition-colors disabled:opacity-40',
                  n === i ? 'border-data/60 bg-data/10 text-data' : 'border-border text-slate-300 hover:border-slate-300/40',
                )}
              >
                {stars[n] !== undefined ? <Stars n={stars[n]!} size="size-3" label={false} /> : n + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Clues">
        {round.clues.map((c) => (
          <li key={c} className="rounded-full border border-border bg-ink-800 px-3 py-1.5 text-[13px] text-slate-200">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {round.kind === 'hunt' ? (
          <HuntRound key={`h-${i}`} round={round} data={data} onScored={(s) => onRound(i, s)} />
        ) : (
          <PickRound key={`p-${i}`} round={round} data={data} onScored={(s) => onRound(i, s)} />
        )}
      </div>
      <div className="mt-5 flex justify-end">
        {i < rounds.length - 1 ? (
          <Button onClick={() => setI(i + 1)} disabled={stars[i] === undefined}>
            Next round <ArrowRight />
          </Button>
        ) : (
          finished && onAllDone && (
            <Button onClick={onAllDone}>
              On to the quiz <ArrowRight />
            </Button>
          )
        )}
      </div>
    </div>
  )
}

function scorePoint(p: LatLon, targetId: string, data: LearnData): Promise<PlaceResult> {
  return score({ kind: 'point', lat: p.lat, lon: p.lon, targetId, weights: data.model.presets.equal! })
}

export function HuntRound({ round, data, onScored }: { round: { target: string }; data: LearnData; onScored: (stars: number) => void }) {
  const reduced = useReducedMotion()
  const [pin, setPin] = useState<LatLon | null>(null)
  const [state, setState] = useState<{ status: 'idle' } | { status: 'scoring' } | { status: 'ocean' } | { status: 'error' } | { status: 'done'; result: PlaceResult; best: LatLon & { sai: number }; stars: number }>({ status: 'idle' })
  const [bestStars, setBestStars] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)
  const pinId = useId()

  const check = async (p: LatLon) => {
    setState({ status: 'scoring' })
    try {
      const [result, best] = await Promise.all([scorePoint(p, round.target, data), bestFor(round.target, data.model)])
      if (!result.land || result.verdict?.sai == null) return setState({ status: 'ocean' })
      const s = huntStars(result.verdict.sai, best.sai)
      setState({ status: 'done', result, best, stars: s })
      setBestStars((b) => Math.max(b, s))
      onScored(s)
    } catch {
      setState({ status: 'error' })
    }
  }
  const place = (fx: number, fy: number) => {
    setPin(mapToLatLon(fx, fy))
    setState({ status: 'idle' })
  }
  const done = state.status === 'done' ? state : null
  const word = done ? (['Keep exploring', 'A start', 'Close!', 'Excellent!'] as const)[done.stars] : ''

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="self-start overflow-hidden rounded-2xl border border-border bg-ink-950">
        <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <div
            ref={mapRef}
            tabIndex={0}
            role="application"
            aria-label="World map. Tap a place, or use the arrow keys to move the marker and Enter to score it."
            aria-describedby={pinId}
            className="relative aspect-[2/1] w-full min-w-[640px] cursor-crosshair sm:min-w-0 touch-manipulation select-none focus-visible:outline-2 focus-visible:-outline-offset-2"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              place((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 1
              const p = pin ?? { lat: 20, lon: 0 }
              const moves: Record<string, LatLon> = {
                ArrowUp: { lat: Math.min(89, p.lat + step), lon: p.lon },
                ArrowDown: { lat: Math.max(-89, p.lat - step), lon: p.lon },
                ArrowLeft: { lat: p.lat, lon: p.lon - step < -180 ? p.lon - step + 360 : p.lon - step },
                ArrowRight: { lat: p.lat, lon: p.lon + step > 180 ? p.lon + step - 360 : p.lon + step },
              }
              if (moves[e.key]) {
                e.preventDefault()
                setPin(moves[e.key]!)
                setState({ status: 'idle' })
              } else if (e.key === 'Enter' && pin) {
                e.preventDefault()
                void check(pin)
              }
            }}
          >
            <img src={asset('media/earth-2k.webp')} srcSet={`${asset('media/earth-1k.webp')} 1024w, ${asset('media/earth-2k.webp')} 2048w`} sizes="(min-width: 1024px) 760px, 640px" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-85" />
            {done && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true">
                <motion.line
                  x1={pin!.lon + 180}
                  y1={90 - pin!.lat}
                  x2={done.best.lon + 180}
                  y2={90 - done.best.lat}
                  stroke="var(--reference)"
                  strokeWidth="0.6"
                  strokeDasharray="2 1.5"
                  vectorEffect="non-scaling-stroke"
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
            )}
            {done && (
              <motion.span
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: px(done.best.lon), top: py(done.best.lat) }}
                initial={reduced ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: reduced ? 0 : 0.6, type: 'spring', stiffness: 420, damping: 18 }}
              >
                <span className="block size-4 rounded-full border-2 border-reference bg-reference/40 shadow-[0_0_0_6px_rgb(240_187_110/0.2)]" />
                <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded bg-ink-950/90 px-1.5 py-0.5 text-[11px] text-reference">SolMate’s best</span>
              </motion.span>
            )}
            {pin && (
              <motion.span
                key={`${pin.lat},${pin.lon}`}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-data"
                style={{ left: px(pin.lon), top: py(pin.lat) }}
                initial={reduced ? false : { y: -14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              >
                <MapPin className="size-7 fill-data/30 drop-shadow-[0_2px_4px_rgb(0_0_0/0.8)]" />
              </motion.span>
            )}
          </div>
        </div>
        <p className="px-3 py-2 text-xs text-slate-400 sm:hidden">Swipe the map sideways to see the whole world.</p>
      </div>

      <div className="flex flex-col rounded-2xl border border-border bg-ink-850 p-5" aria-live="polite">
        <p id={pinId} className="text-sm text-slate-300">
          {pin ? (
            <>
              Your spot: <span className="text-slate-100">{placeLabel(pin.lat, pin.lon).name}</span>
            </>
          ) : (
            'Tap the map where you think Earth matches best.'
          )}
        </p>
        <Button className="mt-3 self-start" disabled={!pin || state.status === 'scoring'} onClick={() => pin && void check(pin)}>
          {state.status === 'scoring' ? <Loader2 className="animate-spin" /> : <Crosshair />}
          {state.status === 'scoring' ? 'Scoring with NASA data…' : 'Score my spot'}
        </Button>
        {state.status === 'ocean' && <p className="mt-4 text-[15px] text-slate-200">That is ocean or ice-covered land with no data. Try a spot on land.</p>}
        {state.status === 'error' && <p className="mt-4 text-[15px] text-negative">Scoring did not work this time. Try again.</p>}
        <AnimatePresence>
          {done && (
            <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
              <div className="flex items-center gap-3">
                <Stars n={done.stars} size="size-6" />
                <p className="text-lg font-semibold text-slate-100">{word}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-slate-400">Your spot</dt>
                  <dd className="tabular text-3xl font-semibold text-data">{Math.round(done.result.verdict!.sai!)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">SolMate’s best</dt>
                  <dd className="tabular text-3xl font-semibold text-reference">{Math.round(done.best.sai)}</dd>
                </div>
              </dl>
              <p className="text-[14px] leading-relaxed text-slate-300">
                SolMate’s best is in <span className="text-slate-100">{placeLabel(done.best.lat, done.best.lon).name}</span>,{' '}
                <span className="tabular">{Math.round(distanceKm(pin!, done.best)).toLocaleString('en')}</span> km from your spot.
                {(() => {
                  const s = strengths(done.result.verdict)
                  return s.best ? ` Your spot matches best on ${s.best} and differs most on ${s.worst}.` : ''
                })()}
              </p>
              {done.stars < 3 && (
                <p className="flex items-center gap-1.5 text-[13px] text-slate-400">
                  <RotateCcw className="size-3.5" aria-hidden="true" /> Tap somewhere else to try again. Your best so far: <Stars n={bestStars} size="size-3.5" label={false} />
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** A NASA GIBS image that fades in when it arrives (GIBS can take a few seconds). */
function SatImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  return (
    <>
      {state !== 'ready' && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">{state === 'loading' ? 'Loading image…' : 'Image not available'}</span>}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
        className={cn('h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03]', state === 'ready' ? 'opacity-100' : 'opacity-0')}
      />
    </>
  )
}

function PickRound({ round, data, onScored }: { round: Extract<Round, { kind: 'pick' }>; data: LearnData; onScored: (stars: number) => void }) {
  const reduced = useReducedMotion()
  const [choice, setChoice] = useState<number | null>(null)
  const [scores, setScores] = useState<(PlaceResult | null)[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (choice === null) return
    let alive = true
    Promise.all(round.options.map((o) => scorePoint(o, round.target, data).catch(() => null))).then((r) => {
      if (!alive) return
      if (r.every((x) => !x?.verdict)) return setError(true)
      setScores(r)
    })
    return () => {
      alive = false
    }
  }, [choice, round, data])

  const sai = (n: number) => scores?.[n]?.verdict?.sai ?? null
  const order = useMemo(() => (scores ? [0, 1, 2].sort((a, b) => (sai(b) ?? -1) - (sai(a) ?? -1)) : null), [scores]) // eslint-disable-line react-hooks/exhaustive-deps
  const stars = order && choice !== null ? (choice === order[0] ? 3 : choice === order[1] ? 1 : 0) : null
  const reported = useRef(false)
  useEffect(() => {
    if (stars !== null && !reported.current) {
      reported.current = true
      onScored(stars)
    }
  }, [stars, onScored])

  return (
    <div>
      <p className="text-[15px] text-slate-300">{choice === null ? 'Which place is the best training ground? Pick one.' : stars === null ? 'Scoring all three with NASA data…' : ''}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {round.options.map((o: Place, n) => {
          const s = sai(n)
          const winner = order?.[0] === n
          return (
            <button
              key={o.name}
              type="button"
              disabled={choice !== null}
              aria-pressed={choice === n}
              onClick={() => setChoice(n)}
              className={cn(
                'group overflow-hidden rounded-2xl border bg-ink-850 text-left transition-colors',
                choice === null && 'border-border hover:border-data/50',
                choice === n && 'border-data/70',
                choice !== null && choice !== n && 'border-border',
                winner && 'ring-2 ring-reference/70',
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-950">
                <SatImage src={gibsWindow(o.lat, o.lon, 40, 'imagery', 256)} alt={`Satellite image of ${o.name}`} />
                {choice === n && <span className="absolute left-2 top-2 rounded bg-ink-950/90 px-2 py-0.5 text-xs text-data">Your pick</span>}
                {winner && <span className="absolute right-2 top-2 rounded bg-ink-950/90 px-2 py-0.5 text-xs text-reference">Best match</span>}
              </div>
              <div className="flex items-baseline justify-between gap-2 p-3.5">
                <span className="text-[14px] text-slate-100">{o.name}</span>
                {s !== null && (
                  <motion.span initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="tabular text-xl font-semibold text-slate-100">
                    {Math.round(s)}
                  </motion.span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-slate-400">Images: NASA/USGS Landsat via NASA GIBS, 40 km across</p>
      {error && <p className="mt-4 text-negative">Scoring did not work this time. Reload the page to try again.</p>}
      {stars !== null && order && (
        <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-ink-850 p-5 sm:flex-row sm:items-center" aria-live="polite">
          <Stars n={stars} size="size-6" />
          <p className="text-[15px] leading-relaxed text-slate-200">
            <span className="font-semibold text-slate-100">{stars === 3 ? 'Right! ' : 'Good try. '}</span>
            {order[0] === round.answer ? round.lesson : `${round.options[order[0]!]!.name} scores highest.`}
            {(() => {
              const s = strengths(scores?.[order[0]!]?.verdict ?? null)
              return s.best ? ` It matches best on ${s.best}.` : ''
            })()}
          </p>
        </motion.div>
      )}
    </div>
  )
}
