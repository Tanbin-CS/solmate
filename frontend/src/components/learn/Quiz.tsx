import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, Flame, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { passMark, type Question } from './content'
import { Stars } from './Hunter'

const ease = [0.16, 1, 0.3, 1] as const

/**
 * One question at a time. Tap an answer (or press 1-4): a right answer pops, a wrong one shakes and
 * the right one lights up, and every answer is explained.
 */
export function Quiz({ questions, best, onFinish }: { questions: Question[]; best: number | null; onFinish: (right: number) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [finished, setFinished] = useState(false)
  const reduced = useReducedMotion()
  const nextRef = useRef<HTMLButtonElement>(null)
  const q = questions[i]!
  const need = passMark(questions.length)

  const choose = (n: number) => {
    if (picked !== null) return
    const ok = n === q.answer
    setPicked(n)
    setResults((r) => [...r, ok])
    setRight((r) => r + (ok ? 1 : 0))
    setStreak((s) => (ok ? s + 1 : 0))
  }
  const next = () => {
    if (i === questions.length - 1) {
      setFinished(true)
      onFinish(right)
    } else {
      setI(i + 1)
      setPicked(null)
    }
  }
  const restart = () => {
    setI(0)
    setPicked(null)
    setRight(0)
    setStreak(0)
    setResults([])
    setFinished(false)
  }

  // number keys answer; Enter moves on
  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [role="application"]')) return
      const n = Number(e.key) - 1
      if (picked === null && n >= 0 && n < q.options.length) choose(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => {
    if (picked !== null) nextRef.current?.focus({ preventScroll: true })
  }, [picked])

  if (finished) {
    const passed = right >= need
    const stars = right === questions.length ? 3 : passed ? 2 : right > 0 ? 1 : 0
    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease }}
        className="flex flex-col items-center rounded-3xl border border-border bg-ink-850 px-6 py-10 text-center sm:py-12"
        role="status"
      >
        <ScoreRing right={right} total={questions.length} passed={passed} />
        <div className="mt-5">
          <Stars n={stars} size="size-8" pop />
        </div>
        <p className={cn('mt-4 text-2xl font-semibold', passed ? 'text-positive' : 'text-slate-100')}>{passed ? (right === questions.length ? 'Perfect score!' : 'Level passed!') : 'Almost there'}</p>
        <p className="mt-2 max-w-sm text-pretty text-slate-300">
          {passed ? 'You earned this level’s badge, and the next level is open.' : `You need ${need} right to pass. Have another look at the story cards, then try again.`}
        </p>
        {best !== null && (
          <p className="mt-1 text-sm text-slate-400">
            Your best: {Math.max(best, right)} of {questions.length}
          </p>
        )}
        <Button variant="outline" size="lg" className="mt-6" onClick={restart}>
          <RotateCcw /> Try again
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-ink-850 p-5 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {questions.map((_, n) => (
            <span key={n} className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
              <motion.span
                className={cn('block h-full rounded-full', results[n] === undefined ? 'bg-data' : results[n] ? 'bg-positive' : 'bg-negative')}
                initial={false}
                animate={{ width: n < results.length ? '100%' : n === i ? '35%' : '0%' }}
                transition={{ duration: reduced ? 0 : 0.5, ease }}
              />
            </span>
          ))}
        </div>
        <AnimatePresence>
          {streak >= 2 && (
            <motion.span
              key={streak}
              initial={reduced ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-reference/15 px-2.5 py-1 text-xs font-semibold text-reference"
            >
              <Flame className="size-3.5" aria-hidden="true" /> {streak} in a row
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40 }}
          transition={{ duration: 0.35, ease }}
        >
          <p className="mt-6 tabular text-sm text-slate-400">
            Question {i + 1} of {questions.length}
          </p>
          <h3 id={`q-${i}`} className="mt-2 text-balance text-xl font-semibold leading-snug text-slate-100 sm:text-2xl">
            {q.q}
          </h3>
          <div role="group" aria-labelledby={`q-${i}`} className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((o, n) => {
              const isAnswer = n === q.answer
              const state = picked === null ? 'idle' : isAnswer ? 'right' : n === picked ? 'wrong' : 'other'
              return (
                <motion.button
                  key={o}
                  type="button"
                  aria-pressed={picked === n}
                  aria-disabled={picked !== null}
                  onClick={() => choose(n)}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={
                    state === 'wrong' && !reduced
                      ? { opacity: 1, y: 0, x: [0, -9, 9, -6, 6, 0] }
                      : state === 'right' && picked === n && !reduced
                        ? { opacity: 1, y: 0, scale: [1, 1.05, 1] }
                        : { opacity: state === 'other' ? 0.55 : 1, y: 0 }
                  }
                  transition={state === 'idle' ? { delay: reduced ? 0 : 0.05 * n, duration: 0.35, ease } : { duration: 0.45 }}
                  whileHover={picked === null && !reduced ? { y: -2 } : undefined}
                  whileTap={picked === null && !reduced ? { scale: 0.98 } : undefined}
                  className={cn(
                    'flex min-h-16 items-center gap-3.5 rounded-2xl border-2 px-4 py-3 text-left text-[16px] leading-snug transition-colors',
                    state === 'idle' && 'border-border bg-ink-800 text-slate-100 hover:border-data/60 hover:bg-ink-700',
                    state === 'right' && 'border-positive bg-positive/15 text-slate-100',
                    state === 'wrong' && 'border-negative bg-negative/15 text-slate-100',
                    state === 'other' && 'border-border bg-ink-800 text-slate-300',
                    picked !== null && 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                      state === 'right' ? 'bg-positive text-ink-950' : state === 'wrong' ? 'bg-negative text-ink-950' : 'bg-ink-600 text-slate-200',
                    )}
                  >
                    {state === 'right' ? <Check className="size-4" aria-label="Right answer" /> : state === 'wrong' ? <X className="size-4" aria-label="Your answer, not right" /> : n + 1}
                  </span>
                  {o}
                </motion.button>
              )
            })}
          </div>
          {picked === null && <p className="mt-4 hidden text-xs text-slate-500 sm:block">Tip: press 1 to {q.options.length} on your keyboard to answer.</p>}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {picked !== null && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className={cn('mt-6 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between', picked === q.answer ? 'bg-positive/10' : 'bg-negative/10')}
            role="status"
          >
            <p className="max-w-[60ch] text-pretty text-[15px] leading-relaxed text-slate-200">
              <span className={cn('font-semibold', picked === q.answer ? 'text-positive' : 'text-negative')}>{picked === q.answer ? 'Right! ' : 'Not quite. '}</span>
              {q.explain}
            </p>
            <Button ref={nextRef} size="lg" className="shrink-0" onClick={next}>
              {i === questions.length - 1 ? 'See my score' : 'Next question'} <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ScoreRing({ right, total, passed }: { right: number; total: number; passed: boolean }) {
  const reduced = useReducedMotion()
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--ink-700)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={passed ? 'var(--positive)' : 'var(--reference)'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduced ? c * (1 - right / total) : c }}
          animate={{ strokeDashoffset: c * (1 - right / total) }}
          transition={{ duration: reduced ? 0 : 1.1, ease }}
        />
      </svg>
      <p className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-4xl font-semibold text-slate-100">{right}</span>
        <span className="text-xs text-slate-400">of {total} right</span>
      </p>
    </div>
  )
}
