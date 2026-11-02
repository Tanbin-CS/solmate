import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Preset } from '@/hooks/useExplorer2State'
import { cn } from '@/lib/utils'
import { PRESET_INFO } from './labels'

const ORDER: Preset[] = ['equal', 'expert', 'mission_ops', 'learned', 'lunar_ops']

/** Dimension-weight presets. Rankings and the selected place re-score instantly. */
export function PresetPicker({ value, onChange, body }: { value: Preset; onChange: (p: Preset) => void; body: 'moon' | 'mars' }) {
  // Lunar ops is a Moon weighting; Mars targets do not offer it
  const order = ORDER.filter((p) => p !== 'lunar_ops' || body === 'moon')
  return (
    <div>
      <p className="label-mono mb-1">Dimension weights</p>
      <div role="radiogroup" aria-label="Dimension weights" className={cn('grid gap-1 rounded-lg border border-border bg-ink-950/60 p-1', order.length > 4 ? 'grid-cols-5' : 'grid-cols-4')}>
        {order.map((p) => (
          <Tooltip key={p}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={value === p}
                onClick={() => onChange(p)}
                className={cn('rounded-md px-1 py-1 text-[12px] transition-colors', value === p ? 'bg-ink-700 text-slate-100' : 'text-slate-400 hover:text-slate-200')}
              >
                {PRESET_INFO[p]!.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64 text-xs leading-relaxed">
              {PRESET_INFO[p]!.description}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
