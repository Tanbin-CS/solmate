import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { gibsWindow } from '@/lib/places'
import { cn } from '@/lib/utils'
import type { PlaceResult } from '@/science/v2/place'
import { alike, DIM_WORDS, type Place, type Round } from './content'
import { scorePoint, strengths, type LearnData } from './data'
import { HuntRound } from './HuntRound'
import { Clues, CountUp, SatImage, Stars } from './parts'

function bodyLabel(data: LearnData, id: string) {
  const t = data.targets.find((x) => x.id === id)
  return { name: t?.name ?? id, body: t?.body === 'mars' ? 'Mars' : 'Moon' }
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
              return s.best && DIM_WORDS[s.best] ? ` It is most alike in ${DIM_WORDS[s.best]!.toLowerCase()}.` : ''
            })()}
          </p>
        </motion.div>
      )}
    </div>
  )
}
