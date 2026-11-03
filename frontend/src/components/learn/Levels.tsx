import { useCallback, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Award, BookOpen, Check, Gamepad2, ListChecks, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LEVELS, passMark, type Level } from './content'
import type { LearnData } from './data'
import { Hunter } from './Hunter'
import { isComplete, isUnlocked, levelOf, type LevelProgress, type Progress } from './progress'
import { Quiz } from './Quiz'
import { StoryDeck } from './StoryDeck'
import { WeighOnWorlds } from './WeighOnWorlds'

/** The six levels as a path: done, open or locked. */
export function LevelPath({ progress, active, onPick }: { progress: Progress; active: number; onPick: (i: number) => void }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Levels">
      {LEVELS.map((l, i) => {
        const open = isUnlocked(progress, i)
        const done = isComplete(progress, l.id)
        return (
          <li key={l.id}>
            <button
              type="button"
              disabled={!open}
              onClick={() => onPick(i)}
              aria-current={i === active ? 'step' : undefined}
              className={cn(
                'flex h-full w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                i === active ? 'border-data/60 bg-data/10' : 'border-border bg-ink-850 hover:border-slate-300/30',
                !open && 'cursor-not-allowed opacity-50 hover:border-border',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular',
                  done ? 'border-positive/60 bg-positive/15 text-positive' : i === active ? 'border-data/60 text-data' : 'border-slate-400/40 text-slate-300',
                )}
              >
                {done ? <Check className="size-4" aria-label="Done" /> : open ? i + 1 : <Lock className="size-3.5" aria-label="Locked" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-slate-400">Level {i + 1}</span>
                <span className="block text-[14px] leading-snug text-slate-100">{l.title}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
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

  const steps: { id: Step; label: string; icon: typeof BookOpen; open: boolean; done: boolean }[] = [
    { id: 'cards', label: `Story · ${level.cards.length} cards`, icon: BookOpen, open: true, done: lp.cards },
    ...(activity
      ? [{ id: 'play' as const, label: activity.kind === 'rounds' ? `Analog Hunter · ${activity.rounds.length} ${activity.rounds.length === 1 ? 'round' : 'rounds'}` : 'Try it', icon: Gamepad2, open: lp.cards, done: played }]
      : []),
    { id: 'quiz', label: `Quiz · ${level.quiz.length} questions`, icon: ListChecks, open: lp.cards && played, done: lp.quiz !== null && lp.quiz >= passMark(level.quiz.length) },
  ]

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tabular text-sm text-slate-400">
            Level {index + 1} of {LEVELS.length}
          </p>
          <h2 id={`level-${level.id}`} className="mt-1 text-balance text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
            {level.title}
          </h2>
          <p className="mt-2 text-[17px] text-slate-300">{level.goal}</p>
        </div>
        <p className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', complete ? 'border-reference/50 text-reference' : 'border-border text-slate-400')}>
          <Award className="size-4" aria-hidden="true" />
          {complete ? `Badge earned: ${level.badge}` : `Badge: ${level.badge}`}
        </p>
      </div>

      <div role="tablist" aria-label="Steps" className="mt-6 flex flex-wrap gap-2">
        {steps.map((s, n) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            id={`tab-${level.id}-${s.id}`}
            aria-selected={step === s.id}
            aria-controls={`panel-${level.id}`}
            disabled={!s.open}
            onClick={() => setStep(s.id)}
            className={cn(
              'flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              step === s.id ? 'border-data/60 bg-data/10 text-slate-100' : 'border-border text-slate-300 hover:text-slate-100',
            )}
          >
            <span className="tabular text-slate-400">{n + 1}</span>
            <s.icon className="size-4" aria-hidden="true" />
            {s.label}
            {s.done && <Check className="size-4 text-positive" aria-label="done" />}
          </button>
        ))}
      </div>

      <div id={`panel-${level.id}`} role="tabpanel" aria-labelledby={`tab-${level.id}-${step}`} className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.1 : 0.35 }}>
            {step === 'cards' && (
              <StoryDeck
                cards={level.cards}
                data={data}
                done={lp.cards}
                onDone={() => {
                  update(level.id, (p) => ({ ...p, cards: true }))
                  setStep(activity ? 'play' : 'quiz')
                }}
              />
            )}
            {step === 'play' && activity?.kind === 'rounds' && data && <Hunter rounds={activity.rounds} data={data} stars={lp.stars} onRound={setStars} onAllDone={() => setStep('quiz')} />}
            {step === 'play' && activity?.kind === 'rounds' && !data && <p className="text-slate-400">Loading NASA data…</p>}
            {step === 'play' && activity?.kind === 'weigh' && (
              <div>
                <WeighOnWorlds data={data} onTry={() => setStars(0, 3)} />
                {played && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => setStep('quiz')}>
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
                    <Button onClick={onNext}>
                      Level {index + 2}: {LEVELS[index + 1]!.title} <ArrowRight />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
