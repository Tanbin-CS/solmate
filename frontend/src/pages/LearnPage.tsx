import { useEffect, useRef, useState } from 'react'
import { Award, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { LEVELS } from '@/components/learn/content'
import { useLearnData } from '@/components/learn/data'
import { Explainer } from '@/components/learn/Explainer'
import { FreePlay } from '@/components/learn/FreePlay'
import { LevelPath, LevelView } from '@/components/learn/Levels'
import { isComplete, isUnlocked, useProgress } from '@/components/learn/progress'
import { cn } from '@/lib/utils'

/** /learn: SolMate for students aged 10-16. A short explainer, six levels and free play. */
export default function LearnPage() {
  const data = useLearnData()
  const { progress, update, setFree, reset } = useProgress()
  const [active, setActive] = useState(() => {
    const n = LEVELS.findIndex((l, i) => isUnlocked(progress, i) && !isComplete(progress, l.id))
    return n === -1 ? 0 : n
  })
  const levelsRef = useRef<HTMLElement>(null)
  const freeRef = useRef<HTMLElement>(null)
  const earned = LEVELS.filter((l) => isComplete(progress, l.id))

  useEffect(() => {
    const before = document.title
    document.title = 'Learn · SolMate'
    return () => {
      document.title = before
    }
  }, [])

  const go = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="pb-24">
      <PageHeader
        title="Learn: find the Moon and Mars on Earth"
        lead="Astronauts and rovers practise on Earth before they go. Watch the short clip, then play six levels to find the best places to practise yourself."
      />
      <ol className="mx-auto -mt-4 mb-10 flex w-full max-w-4xl flex-wrap gap-2 px-6" aria-label="How it works">
        {['Watch the 30-second clip', 'Read, play, then take the quiz', 'Collect stars and badges'].map((t, i) => (
          <li key={t} className="flex items-center gap-2 rounded-full border border-border bg-ink-850 py-1.5 pl-1.5 pr-3.5 text-sm text-slate-200">
            <span className="flex size-6 items-center justify-center rounded-full bg-data/15 text-xs font-semibold text-data">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>

      <section className="mx-auto w-full max-w-5xl px-6" aria-label="Explainer">
        <Explainer
          data={data}
          onStart={() => {
            setActive(0)
            go(levelsRef.current)
          }}
          onFree={() => go(freeRef.current)}
        />
      </section>

      <section ref={levelsRef} className="mx-auto mt-20 w-full max-w-6xl scroll-mt-24 px-6" aria-labelledby="levels-title">
        <h2 id="levels-title" className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Your mission map
        </h2>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-slate-300">
          Six levels. In each one you read a few story cards, play a game and answer a short quiz. Pass the quiz to win a badge and open the next level. Your progress is saved on this device only.
        </p>
        <div className="mt-8">
          <LevelPath progress={progress} active={active} onPick={setActive} />
        </div>
        <div className="mt-8">
          <LevelView
            key={LEVELS[active]!.id}
            level={LEVELS[active]!}
            index={active}
            data={data}
            progress={progress}
            update={update}
            onNext={() => {
              setActive((a) => Math.min(a + 1, LEVELS.length - 1))
              go(levelsRef.current)
            }}
          />
        </div>
      </section>

      <section ref={freeRef} className="mx-auto mt-20 w-full max-w-6xl scroll-mt-24 border-t border-border px-6 pt-12" aria-labelledby="free-title">
        <h2 id="free-title" className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Analog Hunter
        </h2>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-slate-300">
          A hot-and-cold game for all eleven places, open from the start. Every tap is checked in your browser with the same NASA data SolMate uses.
        </p>
        <div className="mt-6">{data ? <FreePlay data={data} free={progress.free} onStars={setFree} /> : <p className="text-slate-400">Loading NASA data…</p>}</div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-6xl border-t border-border px-6 pt-12" aria-labelledby="badges-title">
        <h2 id="badges-title" className="text-2xl font-semibold tracking-tight">
          Your badges
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {LEVELS.map((l) => {
            const got = isComplete(progress, l.id)
            return (
              <li key={l.id} className={cn('flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm', got ? 'border-reference/50 bg-reference/10 text-reference' : 'border-dashed border-border text-slate-400')}>
                <Award className="size-4" aria-hidden="true" />
                {l.badge}
                <span className="sr-only">{got ? ', earned' : ', not earned yet'}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <p className="tabular text-slate-300">
            {earned.length} of {LEVELS.length} badges earned
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm('Start again? This clears your stars, quiz scores and badges on this device.')) {
                reset()
                setActive(0)
              }
            }}
          >
            <RotateCcw /> Start again
          </Button>
        </div>
      </section>
    </div>
  )
}
