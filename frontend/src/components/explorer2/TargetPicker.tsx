import type { Target } from '@/science/v2/model'
import { cn } from '@/lib/utils'
import { BODY } from '@/components/explorer/roles'
import { groupTargets } from './labels'

/** Choose one of the 11 targets (9 Artemis III regions, Jezero, Arcadia Planitia). */
export function TargetPicker({ targets, value, onChange }: { targets: Target[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Planetary target" className="space-y-2">
      {groupTargets(targets).map((g) => (
        <div key={g.label}>
          <p className="label-mono mb-1">{g.label}</p>
          <div className="grid grid-cols-2 gap-1">
            {g.items.map((t) => {
              const active = t.id === value
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(t.id)}
                  className={cn(
                    'truncate rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors',
                    active ? 'border-slate-300/40 bg-ink-700 text-slate-100' : 'border-border text-slate-400 hover:bg-ink-800 hover:text-slate-200',
                  )}
                  title={t.name}
                >
                  <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: BODY[t.body].color }} aria-hidden="true" />
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
