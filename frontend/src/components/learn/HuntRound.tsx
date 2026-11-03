import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowUp, Check, Eye, Flame, Lightbulb, Loader2, MapPin, Minus, Snowflake, Thermometer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCountries } from '@/lib/countries'
import { gibsWindow, placeLabel } from '@/lib/places'
import { cn } from '@/lib/utils'
import type { Verdict } from '@/science/v2/verdict'
import { DIM_WORDS, distanceKm, heat, huntStars, mapPos, trend, type Heat, type LatLon } from './content'
import { bestFor, scorePoint, strengths, type LearnData } from './data'
import { CountUp, SatImage, Stars } from './parts'
import { Upright, ZoomMap } from './ZoomMap'

/** A circle a few thousand km wide around (not centred on) the answer, the same on every visit. */
function hintArea(id: string, best: LatLon) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = ((h % 360) * Math.PI) / 180
  return {
    lat: Math.max(-70, Math.min(70, best.lat + Math.sin(a) * 7)),
    lon: best.lon + Math.cos(a) * 9,
    r: 16,
  }
}

type Try = { p: LatLon; sai: number; verdict: Verdict; place: string }
type Best = LatLon & { sai: number }

const HEAT_BG = ['bg-data', 'bg-slate-200', 'bg-reference', 'bg-mars', 'bg-mars'] as const
const STEPS = ['Read the clues', 'Tap any place on land', 'Follow hot and cold to the best spot']

function HeatIcon({ h, className }: { h: Heat; className?: string }) {
  const Icon = h.level >= 3 ? Flame : h.level === 0 ? Snowflake : Thermometer
  return <Icon className={cn(h.tone, className)} aria-hidden="true" />
}

/** Cold-to-hot bar with your latest try, and your best try as a faint mark. */
function HeatBar({ now, top }: { now: number; top: number }) {
  const reduced = useReducedMotion()
  const pos = (r: number) => `${Math.min(100, Math.max(0, r * 100))}%`
  return (
    <div className="pt-1" aria-hidden="true">
      <div className="relative h-3 rounded-full bg-[linear-gradient(90deg,var(--data),var(--slate-300)_40%,var(--reference)_65%,var(--mars))]">
        {top > now && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70 bg-ink-950/60" style={{ left: pos(top) }} />}
        <motion.span
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ink-950 shadow-[0_2px_8px_rgb(0_0_0/0.6)]"
          initial={false}
          animate={{ left: pos(now) }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 18 }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>Cold</span>
        <span>Warm</span>
        <span>Hot</span>
        <span>Found it</span>
      </div>
    </div>
  )
}

/** Each part of the match, as a bar a child can read: which parts are alike and which are not. */
function WhyBars({ verdict }: { verdict: Verdict }) {
  const reduced = useReducedMotion()
  const dims = verdict.dimensions.filter((d) => d.score !== null && DIM_WORDS[d.id])
  if (!dims.length) return null
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-slate-200">Why? Part by part:</p>
      <ul className="mt-2 space-y-1.5">
        {dims.map((d, n) => {
          const v = Math.round((d.score ?? 0) * 100)
          return (
            <li key={d.id} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-[12.5px] sm:grid-cols-[8.5rem_1fr_2rem]">
              <span className="truncate text-slate-300">{DIM_WORDS[d.id]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-ink-700">
                <motion.span
                  className={cn('block h-full rounded-full', v >= 70 ? 'bg-positive' : v >= 40 ? 'bg-reference' : 'bg-ink-500')}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${v}%` }}
                  transition={{
                    delay: reduced ? 0 : 0.05 * n,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              </span>
              <span className="tabular text-right text-slate-400">{v}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Hot and cold: every tap on the map is scored at once in the browser, and the game says how close
 * it is to SolMate's best place and whether it is warmer or colder than the try before. Stars count
 * only until the answer is shown; finding a red-hot spot shows it automatically.
 */
export function HuntRound({ round, data, onScored }: { round: { target: string }; data: LearnData; onScored: (stars: number) => void }) {
  const reduced = useReducedMotion()
  const [best, setBest] = useState<Best | null>(null)
  const countries = useCountries()
  const [pin, setPin] = useState<LatLon | null>(null)
  const [tries, setTries] = useState<Try[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<'ocean' | 'error' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [bestVerdict, setBestVerdict] = useState<Verdict | null>(null)
  const [hint, setHint] = useState<(LatLon & { r: number }) | null>(null)
  const [fit, setFit] = useState<LatLon[] | null>(null)
  const seq = useRef(0)
  const statusId = useId()

  useEffect(() => {
    let alive = true
    bestFor(round.target, data.model).then(
      (b) => alive && setBest(b),
      () => alive && setNote('error'),
    )
    return () => {
      alive = false
    }
  }, [round.target, data.model])

  const topTry = tries.reduce<Try | null>((a, b) => (!a || b.sai > a.sai ? b : a), null)
  const stars = best && topTry ? huntStars(topTry.sai, best.sai) : 0

  const reveal = (from: LatLon | null, b: Best | null = best) => {
    if (!b) return
    setRevealed(true)
    setFit(from ? [from, b] : [b])
    scorePoint(b, round.target, data).then(
      (r) => setBestVerdict(r.verdict),
      () => {},
    )
  }

  const tryAt = async (p: LatLon) => {
    const id = ++seq.current
    setPin(p)
    setNote(null)
    setBusy(true)
    try {
      const [r, b] = await Promise.all([scorePoint(p, round.target, data), best ? Promise.resolve(best) : bestFor(round.target, data.model)])
      if (id !== seq.current) return
      setBest(b)
      if (!r.land || !r.verdict || r.verdict.sai == null) return setNote('ocean')
      const t: Try = {
        p,
        sai: r.verdict.sai,
        verdict: r.verdict,
        place: placeLabel(p.lat, p.lon, countries).name,
      }
      setTries((xs) => [...xs, t].slice(-12))
      if (!revealed) {
        const s = huntStars(t.sai, b.sai)
        onScored(s)
        if (s === 3) reveal(p, b)
      }
    } catch {
      if (id === seq.current) setNote('error')
    } finally {
      if (id === seq.current) setBusy(false)
    }
  }

  const showHint = () => {
    if (!best) return
    const h = hintArea(round.target, best)
    setHint(h)
    setFit([
      { lat: h.lat + h.r, lon: h.lon - h.r },
      { lat: h.lat - h.r, lon: h.lon + h.r },
    ])
  }

  const last = tries.at(-1) ?? null
  const before = tries.at(-2)
  const h = last && best ? heat(last.sai, best.sai) : null
  const move = last ? trend(last.sai, before?.sai) : null
  const won = revealed && stars === 3
  const step = tries.length === 0 ? 2 : revealed ? 4 : 3
  const from = topTry?.p ?? null

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <ZoomMap
          label="World map. Tap a place on land to test it. Drag to move, pinch or use the + and − buttons to zoom. With a keyboard, arrow keys move the pin and Enter tests it."
          describedBy={statusId}
          fit={fit}
          onTap={(p) => void tryAt(p)}
          onKey={(e) => {
            const d = e.shiftKey ? 10 : 1
            const wrap = (lon: number) => (lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon)
            const moves: Record<string, (p: LatLon) => LatLon> = {
              ArrowUp: (p) => ({ lat: Math.min(89, p.lat + d), lon: p.lon }),
              ArrowDown: (p) => ({ lat: Math.max(-89, p.lat - d), lon: p.lon }),
              ArrowLeft: (p) => ({ lat: p.lat, lon: wrap(p.lon - d) }),
              ArrowRight: (p) => ({ lat: p.lat, lon: wrap(p.lon + d) }),
            }
            const m = moves[e.key]
            if (m) {
              e.preventDefault()
              setPin((p) => m(p ?? { lat: 20, lon: 0 }))
            } else if (e.key === 'Enter' && pin) {
              e.preventDefault()
              void tryAt(pin)
            }
          }}
        >
          {(scale) => (
            <>
              {hint && !revealed && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-reference/80 bg-reference/10"
                  style={{
                    ...mapPos(hint),
                    width: `${((hint.r * 2) / 360) * 100}%`,
                    height: `${((hint.r * 2) / 180) * 100}%`,
                  }}
                  initial={reduced ? false : { opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                />
              )}
              {revealed && best && from && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true">
                  <motion.line
                    x1={from.lon + 180}
                    y1={90 - from.lat}
                    x2={best.lon + 180}
                    y2={90 - best.lat}
                    stroke="var(--reference)"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                    vectorEffect="non-scaling-stroke"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.4, duration: 0.9 }}
                  />
                </svg>
              )}
              {/* every try so far, coloured from cold to hot */}
              {best &&
                tries.slice(0, -1).map((t, n) => {
                  const th = heat(t.sai, best.sai)
                  return (
                    <Upright key={`${t.p.lat},${t.p.lon},${n}`} scale={scale} at={t.p}>
                      <span className={cn('block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-950/80', HEAT_BG[th.level])} />
                    </Upright>
                  )
                })}
              {revealed && best && (
                <Upright scale={scale} at={best}>
                  <motion.div
                    className="relative -translate-x-1/2 -translate-y-1/2"
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: reduced ? 0 : 0.9,
                      type: 'spring',
                      stiffness: 420,
                      damping: 16,
                    }}
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
                    className={cn('relative -translate-x-1/2 -translate-y-full', h && !busy ? h.tone : 'text-data')}
                    initial={reduced ? false : { y: -24, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  >
                    <MapPin className="size-9 fill-current/30 stroke-[2.2] drop-shadow-[0_3px_4px_rgb(0_0_0/0.9)]" />
                    {busy && <Loader2 className="absolute -right-4 -top-1 size-4 animate-spin text-slate-100" />}
                  </motion.div>
                </Upright>
              )}
            </>
          )}
        </ZoomMap>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>Tap to test a place · drag to move · pinch, double-tap or + / − to zoom</span>
          {best && tries.length > 1 && (
            <span className="flex items-center gap-2" aria-hidden="true">
              Your tries:
              {(['Cold', 'Warm', 'Hot'] as const).map((w, n) => (
                <span key={w} className="flex items-center gap-1">
                  <span className={cn('size-2.5 rounded-full', HEAT_BG[[0, 2, 3][n]!])} />
                  {w}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-border bg-ink-850 p-5">
        <ol className="space-y-2" aria-label="How to play">
          {STEPS.map((s, n) => {
            const at = n + 1
            const st = step > at ? 'done' : step === at ? 'now' : 'next'
            return (
              <li key={s} className={cn('flex items-center gap-3 text-[14.5px] transition-colors', st === 'now' ? 'text-slate-100' : st === 'done' ? 'text-slate-400' : 'text-slate-500')}>
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] tabular transition-colors',
                    st === 'now' ? 'border-data bg-data/15 text-data' : st === 'done' ? 'border-positive/60 bg-positive/15 text-positive' : 'border-ink-500',
                  )}
                >
                  {st === 'done' ? <Check className="size-3" aria-label="done" /> : at}
                </span>
                {s}
              </li>
            )
          })}
        </ol>

        <div id={statusId} className="mt-4 border-t border-border pt-4" aria-live="polite">
          {note === 'ocean' && <p className="text-[15px] text-slate-200">That is sea, or ice with no data. Tap a place on land.</p>}
          {note === 'error' && <p className="text-[15px] text-negative">That did not work. Try again.</p>}
          {!note && !last && !busy && (
            <p className="text-[15px] leading-relaxed text-slate-300">
              Tap anywhere on land. The game tells you if you are <span className="text-data">cold</span>, <span className="text-reference">warm</span> or <span className="text-mars">hot</span>. Keep tapping to get hotter.
            </p>
          )}
          {last && h && (
            <motion.div key={tries.length} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-3">
                <motion.span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink-800"
                  initial={reduced ? false : { scale: 0.6, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                >
                  <HeatIcon h={h} className="size-7" />
                </motion.span>
                <div className="min-w-0">
                  <p className={cn('text-2xl font-semibold leading-tight', h.tone)}>{h.word}</p>
                  {move && (
                    <p className="flex items-center gap-1 text-[13px] text-slate-300">
                      {move === 'warmer' ? <ArrowUp className="size-3.5 text-mars" /> : move === 'colder' ? <ArrowDown className="size-3.5 text-data" /> : <Minus className="size-3.5" />}
                      {move === 'warmer' ? 'Warmer than your last try' : move === 'colder' ? 'Colder than your last try' : 'About the same as your last try'}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[14.5px] text-slate-300">
                <span className="text-slate-100">{last.place}</span> is <CountUp to={Math.round(last.sai)} className="tabular font-semibold text-slate-100" /> out of 100 alike.
              </p>
              <div className="mt-2">
                <HeatBar now={best ? last.sai / best.sai : 0} top={best && topTry ? topTry.sai / best.sai : 0} />
              </div>
              <WhyBars verdict={last.verdict} />
            </motion.div>
          )}
        </div>

        {tries.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-2.5">
            <span className="text-[13px] text-slate-300">{revealed && !won ? 'Stars won before you looked' : 'Your stars'}</span>
            <Stars n={stars} size="size-5" pop={stars > 0} />
          </div>
        )}

        {!revealed && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!hint && (
              <Button variant="outline" onClick={showHint} disabled={!best}>
                <Lightbulb /> Hint
              </Button>
            )}
            {tries.length >= 2 && (
              <Button variant="ghost" onClick={() => reveal(from)}>
                <Eye /> Show me the answer
              </Button>
            )}
          </div>
        )}
        {hint && !revealed && <p className="mt-3 text-[13px] text-reference">The best place is somewhere inside the dashed circle.</p>}

        <AnimatePresence>
          {revealed && best && (
            <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-t border-border pt-4">
              <p className="text-lg font-semibold text-slate-100">{won ? 'You found it!' : 'Here is SolMate’s best place'}</p>
              <div className="mt-3 flex gap-3">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-ink-950">
                  <SatImage src={gibsWindow(best.lat, best.lon, 40, 'imagery', 256)} alt={`Satellite picture of ${placeLabel(best.lat, best.lon, countries).name}`} />
                </div>
                <p className="text-[14px] leading-relaxed text-slate-300">
                  <span className="text-slate-100">{placeLabel(best.lat, best.lon, countries).name}</span> scores <span className="tabular text-reference">{Math.round(best.sai)}</span>.
                  {from && (
                    <>
                      {' '}
                      It is about <span className="tabular">{(Math.round(distanceKm(from, best) / 10) * 10).toLocaleString('en')}</span> km from your best try.
                    </>
                  )}
                  {(() => {
                    const s = strengths(bestVerdict)
                    return s.best && DIM_WORDS[s.best] ? ` It is most alike in ${DIM_WORDS[s.best]!.toLowerCase()}.` : ''
                  })()}
                </p>
              </div>
              <p className="mt-3 text-[13px] text-slate-400">{won ? 'Try another place in space next.' : 'Stars only count before you look. Pick another place in space and try again.'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
