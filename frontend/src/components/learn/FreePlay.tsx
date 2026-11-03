import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { LearnData } from './data'
import { cluesFor } from './content'
import { Clues, HuntRound, Stars } from './Hunter'

/** Analog Hunter with any of the 11 targets, open from the start. Best stars per target are kept. */
export function FreePlay({ data, free, onStars }: { data: LearnData; free: Record<string, number>; onStars: (targetId: string, stars: number) => void }) {
  const [target, setTarget] = useState(data.targets.find((t) => t.body === 'mars')?.id ?? data.targets[0]!.id)
  const groups = [
    { label: 'Mars', items: data.targets.filter((t) => t.body === 'mars') },
    { label: 'Moon: Artemis III regions', items: data.targets.filter((t) => t.body !== 'mars') },
  ]
  const t = data.targets.find((x) => x.id === target)!
  const total = Object.values(free).reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[15px] text-slate-300">Choose a target, then tap the map. Stars collected:</p>
        <p className="tabular text-sm text-slate-300">
          <span className="text-xl font-semibold text-reference">{total}</span> of {data.targets.length * 3}
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label}>
            <p className="mb-1.5 text-xs text-slate-400">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={x.id === target}
                  onClick={() => setTarget(x.id)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors',
                    x.id === target ? 'border-data/60 bg-data/10 text-slate-100' : 'border-border text-slate-300 hover:text-slate-100',
                  )}
                >
                  {x.name}
                  {free[x.id] !== undefined && <Stars n={free[x.id]!} size="size-3" label={false} />}
                  {free[x.id] !== undefined && <span className="sr-only">, {free[x.id]} stars</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt-6 text-balance text-2xl font-semibold tracking-tight text-slate-100">
        Where on Earth is most like <span className={t.body === 'mars' ? 'text-mars' : 'text-reference'}>{t.name}</span>?
      </h3>
      <div className="mt-4">
        <Clues key={target} clues={cluesFor(target)} />
      </div>
      <div className="mt-5">
        <HuntRound key={target} round={{ target }} data={data} onScored={(s) => onStars(target, s)} />
      </div>
    </div>
  )
}
