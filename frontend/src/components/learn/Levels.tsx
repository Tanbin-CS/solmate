import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Award, BookOpen, Check, Gamepad2, ListChecks, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LEVELS, passMark, type Level } from './content'
import type { LearnData } from './data'
import { Hunter } from './Hunter'
import { isComplete, isUnlocked, levelOf, type LevelProgress, type Progress } from './progress'
import { Quiz } from './Quiz'
import { StoryDeck } from './StoryDeck'
import { WeighOnWorlds } from './WeighOnWorlds'

const ease = [0.16, 1, 0.3, 1] as const

/** The six levels as a trail, like a game map: done, open or locked. The line fills as you go. */
export function LevelPath({ progress, active, onPick }: { progress: Progress; active: number; onPick: (i: number) => void }) {
  const reduced = useReducedMotion()
  const done = LEVELS.filter((l) => isComplete(progress, l.id)).length
  const fill = Math.min(1, done / (LEVELS.length - 1))
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2 [scrollbar-width:thin]">
      <ol className="relative grid min-w-[640px] grid-cols-6" aria-label="Levels">
        <span className="absolute left-[8.33%] right-[8.33%] top-7 h-1 rounded-full bg-ink-700" aria-hidden="true" />
        <motion.span
          className="absolute left-[8.33%] top-7 h-1 origin-left rounded-full bg-positive"
          style={{ width: '83.33%' }}
          initial={false}
          animate={{ scaleX: fill }}
          transition={{ duration: reduced ? 0 : 0.8, ease }}
          aria-hidden="true"
        />
        {LEVELS.map((l, i) => {
          const open = isUnlocked(progress, i)
          const complete = isComplete(progress, l.id)
          const current = i === active
          return (
            <li key={l.id} className="relative flex flex-col items-center px-1 text-center">
              <motion.button
                type="button"
                disabled={!open}
                onClick={() => onPick(i)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Level ${i + 1}: ${l.title}${complete ? ', done' : open ? '' : ', locked'}`}
                whileHover={open && !reduced ? { scale: 1.08 } : undefined}
                whileTap={open && !reduced ? { scale: 0.95 } : undefined}
                className={cn(
                  'relative z-10 flex size-14 items-center justify-center rounded-full border-2 text-lg font-semibold tabular transition-colors',
                  complete ? 'border-positive bg-positive text-ink-950' : current ? 'border-data bg-ink-900 text-data' : open ? 'border-slate-400/60 bg-ink-900 text-slate-100' : 'border-ink-600 bg-ink-900 text-slate-500',
                  !open && 'cursor-not-allowed',
                )}
              >
                {current && !reduced && <span className="absolute -inset-1.5 animate-ping rounded-full border-2 border-data/40 [animation-duration:2s]" aria-hidden="true" />}
                {complete ? <Check className="size-6" aria-hidden="true" /> : open ? i + 1 : <Lock className="size-5" aria-hidden="true" />}
              </motion.button>
              <span className={cn('mt-2.5 text-[13px] leading-snug', current ? 'font-medium text-slate-100' : open ? 'text-slate-300' : 'text-slate-400')}>{l.title}</span>
              {complete && <span className="mt-1 text-[11px] text-reference">{l.badge}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

type Step = 'cards' | 'play' | 'quiz'

/** One level, in three steps: read the cards, play, take the quiz. Each step opens the next. */
export function LevelView({
  level,
  index,
  data,
  progress,
  update,
  onNext,
}: {
  level: Level
  index: number
  data: LearnData | null
  progress: Progress
  update: (id: string, fn: (lp: LevelProgress) => LevelProgress) => void
  onNext: () => void
}) {
  const reduced = useReducedMotion()
  const lp = levelOf(progress, level.id)
  const activity = level.activity
  const roundCount = activity?.kind === 'rounds' ? activity.rounds.length : activity ? 1 : 0
  const played = lp.stars.length >= roundCount
  const first: Step = !lp.cards ? 'cards' : !played ? 'play' : 'quiz'
  const [step, setStep] = useState<Step>(first)
  const complete = isComplete(progress, level.id)
  const top = useRef<HTMLDivElement>(null)

  // celebrate the moment the level is completed (not when revisiting a finished level)
  const wasComplete = useRef(complete)
  const [party, setParty] = useState(false)
  useEffect(() => {
    if (complete && !wasComplete.current) setParty(true)
    wasComplete.current = complete
  }, [complete])

  const steps: { id: Step; label: string; icon: typeof BookOpen; open: boolean; done: boolean }[] = [
    { id: 'cards', label: 'Read', icon: BookOpen, open: true, done: lp.cards },
    ...(activity ? [{ id: 'play' as const, label: activity.kind === 'rounds' ? 'Play' : 'Try it', icon: Gamepad2, open: lp.cards, done: played }] : []),
    { id: 'quiz', label: 'Quiz', icon: ListChecks, open: lp.cards && played, done: lp.quiz !== null && lp.quiz >= passMark(level.quiz.length) },
  ]
  const go = (s: Step) => {
    setStep(s)
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }))
  }

  const setStars = useCallback(
    (i: number, s: number) =>
      update(level.id, (p) => {
        const stars = [...p.stars]
        stars[i] = Math.max(s, stars[i] ?? 0)
        for (let n = 0; n < stars.length; n++) stars[n] ??= 0 // keep the array dense
        return { ...p, stars }
      }),
    [level.id, update],
  )

  return (
    <section aria-labelledby={`level-${level.id}`}>
      <div ref={top} className="scroll-mt-24 rounded-3xl border border-border bg-ink-850/70 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="tabular text-sm text-slate-400">
              Level {index + 1} of {LEVELS.length}
            </p>
            <h2 id={`level-${level.id}`} className="mt-1 text-balance text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              {level.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-slate-300">
              <span className="font-medium text-data">Your mission: </span>
              {level.goal}
            </p>
          </div>
          <p className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', complete ? 'border-reference/60 bg-reference/10 text-reference' : 'border-border text-slate-400')}>
            <Award className="size-4" aria-hidden="true" />
            {complete ? `Badge earned: ${level.badge}` : `Win the ${level.badge} badge`}
          </p>
        </div>

        {/* the three steps of a level, joined like a path */}
        <div role="tablist" aria-label="Steps" className="mt-6 flex items-center">
          {steps.map((s, n) => (
            <div key={s.id} className="flex flex-1 items-center last:flex-none">
              <button
                role="tab"
                type="button"
                id={`tab-${level.id}-${s.id}`}
                aria-selected={step === s.id}
                aria-controls={`panel-${level.id}`}
                disabled={!s.open}
                onClick={() => go(s.id)}
                className={cn(
                  'flex items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  step === s.id ? 'border-data bg-data/15 text-slate-100' : s.done ? 'border-positive/50 text-slate-200 hover:bg-ink-700' : 'border-border text-slate-300 hover:bg-ink-700',
                )}
              >
                <span className={cn('flex size-7 items-center justify-center rounded-full', s.done ? 'bg-positive text-ink-950' : step === s.id ? 'bg-data text-ink-950' : 'bg-ink-700')}>
                  {s.done ? <Check className="size-4" aria-label="done" /> : <s.icon className="size-4" aria-hidden="true" />}
                </span>
                {s.label}
              </button>
              {n < steps.length - 1 && (
                <span className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-ink-700" aria-hidden="true">
                  <motion.span className="block h-full bg-positive" initial={false} animate={{ width: s.done ? '100%' : '0%' }} transition={{ duration: reduced ? 0 : 0.6, ease }} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div id={`panel-${level.id}`} role="tabpanel" aria-labelledby={`tab-${level.id}-${step}`} className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -8 }} transition={{ duration: reduced ? 0.1 : 0.4, ease }}>
            {step === 'cards' && (
              <StoryDeck
                cards={level.cards}
                data={data}
                done={lp.cards}
                onDone={() => {
                  update(level.id, (p) => ({ ...p, cards: true }))
                  go(activity ? 'play' : 'quiz')
                }}
              />
            )}
            {step === 'play' && activity?.kind === 'rounds' && data && <Hunter rounds={activity.rounds} data={data} stars={lp.stars} onRound={setStars} onAllDone={() => go('quiz')} />}
            {step === 'play' && activity?.kind === 'rounds' && !data && <p className="text-slate-400">Loading NASA data…</p>}
            {step === 'play' && activity?.kind === 'weigh' && (
              <div>
                <WeighOnWorlds data={data} onTry={() => setStars(0, 3)} />
                {played && (
                  <div className="mt-4 flex justify-end">
                    <Button size="lg" onClick={() => go('quiz')}>
                      On to the quiz <ArrowRight />
                    </Button>
                  </div>
                )}
              </div>
            )}
            {step === 'quiz' && (
              <div>
                <Quiz questions={level.quiz} best={lp.quiz} onFinish={(right) => update(level.id, (p) => ({ ...p, quiz: Math.max(right, p.quiz ?? 0) }))} />
                {complete && index < LEVELS.length - 1 && (
                  <div className="mt-4 flex justify-end">
                    <Button size="lg" onClick={onNext}>
                      Level {index + 2}: {LEVELS[index + 1]!.title} <ArrowRight />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>{party && <Celebration level={level} last={index === LEVELS.length - 1} onClose={() => setParty(false)} onNext={() => (setParty(false), onNext())} />}</AnimatePresence>
    </section>
  )
}

/** Badge reveal when a level is completed. */
function Celebration({ level, last, onClose, onNext }: { level: Level; last: boolean; onClose: () => void; onNext: () => void }) {
  const reduced = useReducedMotion()
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btn.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-title"
        onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="relative w-full max-w-sm rounded-3xl border border-reference/40 bg-ink-900 p-8 text-center"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-2 text-slate-400 hover:bg-ink-700 hover:text-slate-100">
          <X className="size-4" />
        </button>
        <div className="relative mx-auto size-28">
          {!reduced &&
            Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2
              return (
                <motion.span
                  key={i}
                  className={cn('absolute left-1/2 top-1/2 size-2 rounded-full', i % 3 === 0 ? 'bg-data' : i % 3 === 1 ? 'bg-reference' : 'bg-positive')}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90, opacity: 0 }}
                  transition={{ delay: 0.35, duration: 1.1, ease: 'easeOut' }}
                />
              )
            })}
          <motion.div
            className="flex size-28 items-center justify-center rounded-full border-4 border-reference bg-reference/15"
            initial={reduced ? false : { scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 14 }}
          >
            <Award className="size-14 text-reference" aria-hidden="true" />
          </motion.div>
        </div>
        <p className="mt-6 text-sm text-slate-400">Badge earned</p>
        <h3 id="party-title" className="mt-1 text-2xl font-semibold text-reference">
          {level.badge}
        </h3>
        <p className="mt-2 text-slate-300">{last ? 'You finished every level. You are a real mission planner!' : 'Great work. The next level is open.'}</p>
        <Button ref={btn} size="lg" className="mt-6 w-full" onClick={last ? onClose : onNext}>
          {last ? 'Done' : 'Next level'} {!last && <ArrowRight />}
        </Button>
      </motion.div>
    </motion.div>
  )
}
