import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ArrowRight, Check, Crosshair, Droplets, Lightbulb, Loader2, MapPin, Mountain, RotateCcw, Search, Snowflake, Sprout, Star, Thermometer, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { gibsWindow, placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import type { PlaceResult } from '@/science/v2/place'
import { score } from '@/science/v2/scorer'
import type { Verdict } from '@/science/v2/verdict'
import { alike, distanceKm, huntStars, mapPos, type LatLon, type Place, type Round } from './content'
import { bestFor, type LearnData } from './data'
import { Upright, ZoomMap } from './ZoomMap'

export function Stars({ n, size = 'size-5', label = true, pop = false }: { n: number; size?: string; label?: boolean; pop?: boolean }) {
  const reduced = useReducedMotion()
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? 'img' : undefined} aria-label={label ? `${n} of 3 stars` : undefined} aria-hidden={label ? undefined : true}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={pop && !reduced ? { scale: 0, rotate: -40 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: pop ? 0.25 + i * 0.18 : 0, type: 'spring', stiffness: 500, damping: 14 }}
          className="inline-flex"
        >
          <Star className={cn(size, i < n ? 'fill-reference text-reference' : 'text-ink-500')} />
        </motion.span>
      ))}
    </span>
  )
}

/** A picture for each clue, picked from its words. */
function ClueIcon({ text }: { text: string }) {
  const t = text.toLowerCase()
  const Icon = /°c|temperature|swing/.test(t)
    ? Thermometer
    : /cold|frost|ice|freez/.test(t)
      ? Snowflake
      : /dry|rain|water|river/.test(t)
        ? Droplets
        : /plant/.test(t)
          ? Sprout
          : /dust|wind|air/.test(t)
            ? Wind
            : /bare|grey|sand|rock|mineral|mountain|rim|crater|plain|flat|landing|pole/.test(t)
              ? Mountain
              : Search
  return <Icon className="size-4 shrink-0 text-data" aria-hidden="true" />
}

export function Clues({ clues }: { clues: string[] }) {
  const reduced = useReducedMotion()
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Clues">
      {clues.map((c, i) => (
        <motion.li
          key={c}
          initial={reduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduced ? 0 : 0.08 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-2.5 rounded-xl border border-border bg-ink-800 px-3.5 py-2.5 text-[14px] leading-snug text-slate-100"
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-data/10">
            <ClueIcon text={c} />
          </span>
          {c}
        </motion.li>
      ))}
    </ul>
  )
}

/** A 0-100 gauge with your spot and SolMate's best, so the gap is easy to see. */
function MatchMeter({ yours, best }: { yours: number; best: number }) {
  const reduced = useReducedMotion()
  const mark = (v: number, tone: string, bg: string, label: string, delay: number, above: boolean) => (
    <motion.div
      className="absolute top-0 h-full"
      initial={reduced ? { left: `${v}%` } : { left: '0%' }}
      animate={{ left: `${v}%` }}
      transition={{ delay: reduced ? 0 : delay, duration: reduced ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className={cn('absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium', tone, above ? '-top-5' : 'top-[calc(100%+4px)]')}>
        {label} {Math.round(v)}
      </span>
      <span className={cn('absolute inset-y-[-3px] w-1 -translate-x-1/2 rounded-full', bg)} />
    </motion.div>
  )
  return (
    <div className="py-5" aria-hidden="true">
      <div className="relative h-3.5">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <span className="w-[40%] bg-ink-600" />
          <span className="w-[35%] bg-reference/35" />
          <span className="w-[25%] bg-positive/40" />
        </div>
        {mark(best, 'text-reference', 'bg-reference', 'Best', 0.2, false)}
        {mark(yours, 'text-data', 'bg-data', 'You', 0, true)}
      </div>
      <div className="mt-6 flex justify-between text-[11px] text-slate-400">
        <span>Not alike</span>
        <span>A bit alike</span>
        <span>Very alike</span>
      </div>
    </div>
  )
}

export function CountUp({ to, className }: { to: number; className?: string }) {
  const reduced = useReducedMotion()
  const v = useMotionValue(reduced ? to : 0)
  const text = useTransform(v, (n) => String(Math.round(n)))
  useEffect(() => {
    if (reduced) return v.set(to)
    const c = animate(v, to, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [to, reduced, v])
  return <motion.span className={className}>{text}</motion.span>
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
  const reduced = useReducedMotion()
  const [i, setI] = useState(() => Math.min(stars.length, rounds.length - 1))
  const round = rounds[i]!
  const t = bodyLabel(data, round.target)
  const finished = stars.length >= rounds.length
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-1.5" aria-label="Rounds">
          {rounds.map((r, n) => (
            <li key={r.target}>
              <button
                type="button"
                onClick={() => setI(n)}
                disabled={n > stars.length}
                aria-current={n === i ? 'step' : undefined}
                aria-label={`Round ${n + 1}${stars[n] !== undefined ? `, ${stars[n]} stars` : ''}`}
                className={cn(
                  'flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-xs tabular transition-colors disabled:opacity-35',
                  n === i ? 'border-data bg-data/15 text-data' : 'border-border text-slate-300 hover:border-slate-300/40',
                )}
              >
                {stars[n] !== undefined ? <Stars n={stars[n]!} size="size-3" label={false} /> : n + 1}
              </button>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-400">
          Round {i + 1} of {rounds.length}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -30 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            {round.kind === 'hunt' ? 'Where on Earth is most like ' : 'Which place is most like '}
            <span className={t.body === 'Mars' ? 'text-mars' : 'text-reference'}>{t.name}</span>?
          </h3>
          <p className="mt-1 text-[15px] text-slate-400">
            {t.body === 'Mars' ? 'A place on Mars.' : 'A landing region near the Moon’s south pole.'} Read the clues, then {round.kind === 'hunt' ? 'find a match on the map.' : 'pick one of three places.'}
          </p>
          <div className="mt-4">
            <Clues clues={round.clues} />
          </div>
          <div className="mt-5">
            {round.kind === 'hunt' ? <HuntRound round={round} data={data} onScored={(s) => onRound(i, s)} /> : <PickRound round={round} data={data} onScored={(s) => onRound(i, s)} />}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-end">
        {i < rounds.length - 1 ? (
          <Button size="lg" onClick={() => setI(i + 1)} disabled={stars[i] === undefined}>
            Next round <ArrowRight />
          </Button>
        ) : (
          finished &&
          onAllDone && (
            <Button size="lg" onClick={onAllDone}>
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

/** A circle a few thousand km wide around (not centred on) the answer, the same on every visit. */
function hintArea(id: string, best: LatLon) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = ((h % 360) * Math.PI) / 180
  return { lat: Math.max(-70, Math.min(70, best.lat + Math.sin(a) * 7)), lon: best.lon + Math.cos(a) * 9, r: 16 }
}

type HuntState =
  | { status: 'idle' }
  | { status: 'scoring' }
  | { status: 'ocean' }
  | { status: 'error' }
  | { status: 'done'; result: PlaceResult; best: LatLon & { sai: number }; stars: number }

const STEPS = ['Read the clues', 'Tap the map to drop your pin', 'Check how alike it is']

export function HuntRound({ round, data, onScored }: { round: { target: string }; data: LearnData; onScored: (stars: number) => void }) {
  const reduced = useReducedMotion()
  const [pin, setPin] = useState<LatLon | null>(null)
  const [state, setState] = useState<HuntState>({ status: 'idle' })
  const [bestStars, setBestStars] = useState(0)
  const [hint, setHint] = useState<(LatLon & { r: number }) | null>(null)
  const [fit, setFit] = useState<LatLon[] | null>(null)
  const pinId = useId()

  const check = async (p: LatLon) => {
    setState({ status: 'scoring' })
    try {
      const [result, best] = await Promise.all([scorePoint(p, round.target, data), bestFor(round.target, data.model)])
      if (!result.land || result.verdict?.sai == null) return setState({ status: 'ocean' })
      const s = huntStars(result.verdict.sai, best.sai)
      setState({ status: 'done', result, best, stars: s })
      setFit([p, best])
      setBestStars((b) => Math.max(b, s))
      onScored(s)
    } catch {
      setState({ status: 'error' })
    }
  }
  const showHint = async () => {
    const best = await bestFor(round.target, data.model)
    const h = hintArea(round.target, best)
    setHint(h)
    setFit([
      { lat: h.lat + h.r, lon: h.lon - h.r },
      { lat: h.lat - h.r, lon: h.lon + h.r },
    ])
  }
  const done = state.status === 'done' ? state : null
  const step = !pin ? 2 : done ? 4 : 3
  const word = done ? (['Keep exploring', 'Getting warmer', 'Close!', 'Excellent match!'] as const)[done.stars] : ''

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <ZoomMap
          label="World map. Tap a place to drop your pin. Drag to move, pinch or use the + and − buttons to zoom. With a keyboard, arrow keys move the pin and Enter checks it."
          describedBy={pinId}
          fit={fit}
          onTap={(p) => {
            setPin(p)
            if (state.status !== 'scoring') setState({ status: 'idle' })
          }}
          onKey={(e) => {
            const d = e.shiftKey ? 10 : 1
            const wrap = (lon: number) => (lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon)
            const moves: Record<string, (p: LatLon) => LatLon> = {
              ArrowUp: (p) => ({ lat: Math.min(89, p.lat + d), lon: p.lon }),
              ArrowDown: (p) => ({ lat: Math.max(-89, p.lat - d), lon: p.lon }),
              ArrowLeft: (p) => ({ lat: p.lat, lon: wrap(p.lon - d) }),
              ArrowRight: (p) => ({ lat: p.lat, lon: wrap(p.lon + d) }),
            }
            const move = moves[e.key]
            if (move) {
              e.preventDefault()
              setPin((p) => move(p ?? { lat: 20, lon: 0 }))
              setState({ status: 'idle' })
            } else if (e.key === 'Enter' && pin) {
              e.preventDefault()
              void check(pin)
            }
          }}
        >
          {(scale) => (
            <>
              {hint && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-reference/80 bg-reference/10"
                  style={{ ...mapPos(hint), width: `${((hint.r * 2) / 360) * 100}%`, height: `${((hint.r * 2) / 180) * 100}%` }}
                  initial={reduced ? false : { opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                />
              )}
              {done && pin && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true">
                  <motion.line
                    x1={pin.lon + 180}
                    y1={90 - pin.lat}
                    x2={done.best.lon + 180}
                    y2={90 - done.best.lat}
                    stroke="var(--reference)"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                    vectorEffect="non-scaling-stroke"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.5, duration: 0.9 }}
                  />
                </svg>
              )}
              {done && (
                <Upright scale={scale} at={done.best}>
                  <motion.div
                    className="relative -translate-x-1/2 -translate-y-1/2"
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: reduced ? 0 : 1.1, type: 'spring', stiffness: 420, damping: 16 }}
                  >
                    <span className="relative flex size-5 items-center justify-center">
                      {!reduced && <span className="absolute inset-0 animate-ping rounded-full bg-reference/50" />}
                      <span className="size-5 rounded-full border-[3px] border-reference bg-ink-950" />
                    </span>
                    <span className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-950/95 px-2 py-1 text-xs font-medium text-reference">SolMate’s best</span>
                  </motion.div>
                </Upright>
              )}
              {pin && (
                <Upright scale={scale} at={pin}>
                  <motion.div
                    key={`${pin.lat},${pin.lon}`}
                    className="-translate-x-1/2 -translate-y-full text-data"
                    initial={reduced ? false : { y: -24, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  >
                    <MapPin className="size-9 fill-data/40 stroke-[2.2] drop-shadow-[0_3px_4px_rgb(0_0_0/0.9)]" />
                  </motion.div>
                </Upright>
              )}
            </>
          )}
        </ZoomMap>
        <p className="mt-2 text-xs text-slate-400">Drag to move · pinch, double-tap or + / − to zoom · tap to drop your pin</p>
      </div>

      <div className="flex flex-col rounded-2xl border border-border bg-ink-850 p-5">
        <ol className="space-y-2.5" aria-label="How to play">
          {STEPS.map((s, n) => {
            const at = n + 1
            const st = step > at ? 'done' : step === at ? 'now' : 'next'
            return (
              <li key={s} className={cn('flex items-center gap-3 text-[15px] transition-colors', st === 'now' ? 'text-slate-100' : st === 'done' ? 'text-slate-400' : 'text-slate-500')}>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular transition-colors',
                    st === 'now' ? 'border-data bg-data/15 text-data' : st === 'done' ? 'border-positive/60 bg-positive/15 text-positive' : 'border-ink-500',
                  )}
                >
                  {st === 'done' ? <Check className="size-3.5" aria-label="done" /> : at}
                </span>
                {s}
              </li>
            )
          })}
        </ol>

        <p id={pinId} className="mt-4 min-h-6 text-sm text-slate-300" aria-live="polite">
          {pin ? (
            <>
              Your pin: <span className="text-slate-100">{placeLabel(pin.lat, pin.lon).name}</span>
            </>
          ) : (
            'No pin yet.'
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="lg" disabled={!pin || state.status === 'scoring'} onClick={() => pin && void check(pin)}>
            {state.status === 'scoring' ? <Loader2 className="animate-spin" /> : <Crosshair />}
            {state.status === 'scoring' ? 'Checking…' : 'Check my spot'}
          </Button>
          {!done && !hint && (
            <Button size="lg" variant="ghost" onClick={() => void showHint()}>
              <Lightbulb /> Hint
            </Button>
          )}
        </div>
        {hint && !done && <p className="mt-3 text-[13px] text-reference">The best match is somewhere inside the dashed circle.</p>}

        <div aria-live="polite">
          {state.status === 'ocean' && <p className="mt-4 text-[15px] text-slate-200">That is sea, or ice with no data. Try a spot on land.</p>}
          {state.status === 'error' && <p className="mt-4 text-[15px] text-negative">That did not work. Try again.</p>}
          <AnimatePresence>
            {done && (
              <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <Stars n={done.stars} size="size-7" pop />
                  <p className="text-lg font-semibold text-slate-100">{word}</p>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-200">
                  Your spot scores <CountUp to={Math.round(done.result.verdict!.sai!)} className="tabular font-semibold text-data" /> out of 100:{' '}
                  <span className={alike(done.result.verdict!.sai!).tone}>{alike(done.result.verdict!.sai!).word.toLowerCase()}</span>.
                </p>
                <MatchMeter yours={done.result.verdict!.sai!} best={done.best.sai} />
                <p className="text-[14px] leading-relaxed text-slate-300">
                  SolMate’s best match is in <span className="text-slate-100">{placeLabel(done.best.lat, done.best.lon).name}</span>, about{' '}
                  <span className="tabular">{(Math.round(distanceKm(pin!, done.best) / 10) * 10).toLocaleString('en')}</span> km from your pin.
                  {(() => {
                    const s = strengths(done.result.verdict)
                    return s.best ? ` Your spot is most alike in ${s.best} and least alike in ${s.worst}.` : ''
                  })()}
                </p>
                {done.stars < 3 && (
                  <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-slate-400">
                    <RotateCcw className="size-3.5" aria-hidden="true" /> Move your pin and check again to win more stars. Best so far: <Stars n={bestStars} size="size-3.5" label={false} />
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/** A NASA GIBS picture that fades in when it arrives (GIBS can take a few seconds). */
function SatImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  return (
    <>
      {state !== 'ready' && (
        <span className={cn('absolute inset-0 flex items-center justify-center text-xs text-slate-400', state === 'loading' && 'animate-pulse bg-ink-800')}>
          {state === 'loading' ? 'Loading picture…' : 'Picture not available'}
        </span>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
        className={cn('h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.04]', state === 'ready' ? 'opacity-100' : 'opacity-0')}
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
      <p className="text-[15px] text-slate-300" aria-live="polite">
        {choice === null ? 'Tap the place you think is the best training ground.' : stars === null ? 'Checking all three with NASA data…' : 'Here is how alike each place is, out of 100:'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {round.options.map((o: Place, n) => {
          const s = sai(n)
          const winner = order?.[0] === n
          return (
            <motion.button
              key={o.name}
              type="button"
              disabled={choice !== null}
              aria-pressed={choice === n}
              onClick={() => setChoice(n)}
              whileHover={choice === null && !reduced ? { y: -4 } : undefined}
              whileTap={choice === null && !reduced ? { scale: 0.97 } : undefined}
              className={cn(
                'group relative overflow-hidden rounded-2xl border-2 bg-ink-850 text-left transition-colors',
                choice === null && 'border-border hover:border-data/60',
                choice === n && 'border-data',
                choice !== null && choice !== n && 'border-border',
                winner && 'border-reference',
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-950">
                <SatImage src={gibsWindow(o.lat, o.lon, 40, 'imagery', 256)} alt={`Satellite picture of ${o.name}`} />
                {choice === n && <span className="absolute left-2 top-2 rounded-md bg-ink-950/90 px-2 py-0.5 text-xs font-medium text-data">Your pick</span>}
                {winner && (
                  <motion.span
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring', stiffness: 500, damping: 15 }}
                    className="absolute right-2 top-2 rounded-md bg-reference px-2 py-0.5 text-xs font-semibold text-ink-950"
                  >
                    Best match
                  </motion.span>
                )}
              </div>
              <div className="flex items-end justify-between gap-2 p-3.5">
                <span className="text-[14px] leading-snug text-slate-100">{o.name}</span>
                {s !== null && (
                  <span className="shrink-0 text-right">
                    <CountUp to={Math.round(s)} className="tabular block text-2xl font-semibold text-slate-100" />
                    <span className={cn('block text-[11px]', alike(s).tone)}>{alike(s).word}</span>
                  </span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-slate-400">Pictures: NASA/USGS Landsat via NASA GIBS, 40 km across</p>
      {error && <p className="mt-4 text-negative">That did not work. Reload the page to try again.</p>}
      {stars !== null && order && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-ink-850 p-5 sm:flex-row sm:items-center"
        >
          <Stars n={stars} size="size-7" pop />
          <p className="text-[15px] leading-relaxed text-slate-200">
            <span className="font-semibold text-slate-100">{stars === 3 ? 'You got it! ' : 'Good try! '}</span>
            {order[0] === round.answer ? round.lesson : `${round.options[order[0]!]!.name} is the most alike.`}
            {(() => {
              const s = strengths(scores?.[order[0]!]?.verdict ?? null)
              return s.best ? ` It is most alike in ${s.best}.` : ''
            })()}
          </p>
        </motion.div>
      )}
    </div>
  )
}
