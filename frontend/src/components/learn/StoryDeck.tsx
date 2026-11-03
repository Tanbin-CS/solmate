import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Hand } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isInteractive, type Card } from './content'
import type { LearnData } from './data'
import { CardVisual } from './visuals'

const ease = [0.16, 1, 0.3, 1] as const

/**
 * Story cards, one at a time, like a picture book: swipe or use the arrows to turn the page, and
 * play with the picture where it says so. The bar at the top shows how far you are.
 */
export function StoryDeck({ cards, data, onDone, done }: { cards: Card[]; data: LearnData | null; onDone: () => void; done: boolean }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const reduced = useReducedMotion()
  const card = cards[i]!
  const last = i === cards.length - 1
  const go = (n: number) => {
    if (n < 0 || n >= cards.length) return
    setDir(n > i ? 1 : -1)
    setI(n)
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -400) go(i + 1)
    else if (info.offset.x > 70 || info.velocity.x > 400) go(i - 1)
  }
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Story cards"
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('input, [role="application"]')) return
        if (e.key === 'ArrowRight') go(i + 1)
        if (e.key === 'ArrowLeft') go(i - 1)
      }}
    >
      <div className="mb-3 flex gap-1.5">
        {cards.map((c, n) => (
          <button key={c.title} type="button" onClick={() => go(n)} aria-label={`Card ${n + 1}: ${c.title}`} aria-current={n === i ? 'step' : undefined} className="group h-6 flex-1 py-2">
            <span className="block h-full overflow-hidden rounded-full bg-ink-700 transition-colors group-hover:bg-ink-600">
              <motion.span className="block h-full rounded-full bg-data" initial={false} animate={{ width: n <= i ? '100%' : '0%' }} transition={{ duration: reduced ? 0 : 0.45, ease }} />
            </span>
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-ink-850">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${cards.length}: ${card.title}`}
            custom={dir}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: `${dir * 18}%`, rotate: dir * 1.5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: `${-dir * 18}%`, rotate: -dir * 1.5 }}
            transition={{ duration: reduced ? 0.15 : 0.5, ease }}
            drag={reduced ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            className="grid cursor-grab gap-6 p-5 active:cursor-grabbing sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10"
          >
            <div className="flex flex-col justify-center">
              <motion.p initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="tabular text-sm text-slate-400">
                Card {i + 1} of {cards.length}
              </motion.p>
              <motion.h3
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45, ease }}
                className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight text-slate-100 sm:text-[2rem]"
              >
                {card.title}
              </motion.h3>
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45, ease }}
                className="mt-4 max-w-[44ch] text-pretty text-[17px] leading-relaxed text-slate-300 sm:text-[18px]"
              >
                {card.body}
              </motion.p>
              {isInteractive(card.visual) && (
                <motion.p initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-5 flex items-center gap-2 text-sm font-medium text-data">
                  <motion.span animate={reduced ? undefined : { x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="inline-flex">
                    <Hand className="size-4" aria-hidden="true" />
                  </motion.span>
                  Try it: play with the picture
                </motion.p>
              )}
            </div>
            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12, duration: 0.5, ease }}
              className="h-[19rem] cursor-auto sm:h-[21rem]"
              onPointerDown={(e) => e.stopPropagation()} // let the picture's own controls work without turning the page
            >
              <CardVisual visual={card.visual} data={data} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="outline" size="lg" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous card">
          <ArrowLeft /> <span className="hidden sm:inline">Back</span>
        </Button>
        <p className="text-xs text-slate-500">
          <span className="sm:hidden">Swipe to turn the page</span>
          <span className="hidden sm:inline">Use ← → keys or drag to turn the page</span>
        </p>
        {last ? (
          <Button size="lg" onClick={onDone} variant={done ? 'outline' : 'default'} className={cn(!done && 'shadow-[0_0_0_4px_rgb(127_216_230/0.18)]')}>
            {done ? <Check /> : null}
            {done ? 'Done' : 'I’m ready!'} {!done && <ArrowRight />}
          </Button>
        ) : (
          <Button size="lg" onClick={() => go(i + 1)} aria-label="Next card">
            Next <ArrowRight />
          </Button>
        )}
      </div>
    </section>
  )
}
