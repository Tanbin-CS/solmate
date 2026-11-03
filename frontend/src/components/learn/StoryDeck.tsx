import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Card } from './content'
import type { LearnData } from './data'
import { CardVisual } from './visuals'

/** One story card at a time: words on the left, a picture or diagram on the right. */
export function StoryDeck({ cards, data, onDone, done }: { cards: Card[]; data: LearnData | null; onDone: () => void; done: boolean }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const reduced = useReducedMotion()
  const card = cards[i]!
  const last = i === cards.length - 1
  const go = (n: number) => {
    setDir(n > i ? 1 : -1)
    setI(n)
  }
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Story cards"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && !last) go(i + 1)
        if (e.key === 'ArrowLeft' && i > 0) go(i - 1)
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-ink-850">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${cards.length}: ${card.title}`}
            custom={dir}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40 * dir, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40 * dir, filter: 'blur(6px)' }}
            transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-6 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10"
          >
            <div className="flex flex-col justify-center">
              <p className="tabular text-sm text-slate-400">
                {i + 1} / {cards.length}
              </p>
              <h3 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">{card.title}</h3>
              <p className="mt-4 max-w-[46ch] text-pretty text-[17px] leading-relaxed text-slate-300">{card.body}</p>
            </div>
            <div className="h-[18rem] sm:h-[20rem]">
              <CardVisual visual={card.visual} data={data} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous card">
          <ArrowLeft /> Back
        </Button>
        <div className="flex gap-1.5" aria-hidden="true">
          {cards.map((c, n) => (
            <button
              key={c.title}
              type="button"
              tabIndex={-1}
              onClick={() => go(n)}
              className={cn('h-1.5 rounded-full transition-all', n === i ? 'w-6 bg-data' : 'w-1.5 bg-ink-500 hover:bg-slate-400')}
            />
          ))}
        </div>
        {last ? (
          <Button onClick={onDone} variant={done ? 'outline' : 'default'}>
            {done ? <Check /> : null}
            {done ? 'Read' : 'Got it'}
          </Button>
        ) : (
          <Button onClick={() => go(i + 1)} aria-label="Next card">
            Next <ArrowRight />
          </Button>
        )}
      </div>
    </section>
  )
}
