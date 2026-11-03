import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { passMark, type Question } from './content'

/** One question at a time; every answer is explained, right or wrong. */
export function Quiz({ questions, best, onFinish }: { questions: Question[]; best: number | null; onFinish: (right: number) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const [finished, setFinished] = useState(false)
  const reduced = useReducedMotion()
  const q = questions[i]!
  const need = passMark(questions.length)

  if (finished) {
    const passed = right >= need
    return (
      <div className="rounded-2xl border border-border bg-ink-850 p-6 sm:p-8" role="status">
        <p className={cn('text-2xl font-semibold', passed ? 'text-positive' : 'text-slate-100')}>
          {right} of {questions.length} right{passed ? '. Level passed!' : '.'}
        </p>
        <p className="mt-2 text-slate-300">{passed ? 'The next level is open.' : `You need ${need} to pass. Read the cards again and have another go.`}</p>
        {best !== null && <p className="mt-1 text-sm text-slate-400">Your best: {Math.max(best, right)} of {questions.length}</p>}
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => {
            setI(0)
            setPicked(null)
            setRight(0)
            setFinished(false)
          }}
        >
          <RotateCcw /> Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-ink-850 p-6 sm:p-8">
      <p className="tabular text-sm text-slate-400">
        Question {i + 1} of {questions.length}
      </p>
      <h3 id={`q-${i}`} className="mt-2 text-balance text-xl font-semibold text-slate-100 sm:text-2xl">
        {q.q}
      </h3>
      <div role="group" aria-labelledby={`q-${i}`} className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {q.options.map((o, n) => {
          const isAnswer = n === q.answer
          const state = picked === null ? 'idle' : isAnswer ? 'right' : n === picked ? 'wrong' : 'other'
          return (
            <button
              key={o}
              type="button"
              aria-pressed={picked === n}
              disabled={picked !== null}
              onClick={() => {
                setPicked(n)
                if (isAnswer) setRight((r) => r + 1)
              }}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors',
                state === 'idle' && 'border-border bg-ink-800 text-slate-100 hover:border-data/50 hover:bg-ink-700',
                state === 'right' && 'border-positive/70 bg-positive/10 text-slate-100',
                state === 'wrong' && 'border-negative/70 bg-negative/10 text-slate-100',
                state === 'other' && 'border-border bg-ink-800 text-slate-400',
              )}
            >
              {state === 'right' ? (
                <CheckCircle2 className="size-5 shrink-0 text-positive" aria-label="Right answer" />
              ) : state === 'wrong' ? (
                <XCircle className="size-5 shrink-0 text-negative" aria-label="Your answer, wrong" />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-slate-400 text-[11px] text-slate-300" aria-hidden="true">
                  {String.fromCharCode(65 + n)}
                </span>
              )}
              {o}
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {picked !== null && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            role="status"
          >
            <p className="max-w-[60ch] text-pretty text-[15px] leading-relaxed text-slate-300">
              <span className={cn('font-semibold', picked === q.answer ? 'text-positive' : 'text-negative')}>{picked === q.answer ? 'Right! ' : 'Not quite. '}</span>
              {q.explain}
            </p>
            <Button
              className="shrink-0"
              onClick={() => {
                if (i === questions.length - 1) {
                  setFinished(true)
                  onFinish(right)
                } else {
                  setI(i + 1)
                  setPicked(null)
                }
              }}
            >
              {i === questions.length - 1 ? 'See my score' : 'Next question'} <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
