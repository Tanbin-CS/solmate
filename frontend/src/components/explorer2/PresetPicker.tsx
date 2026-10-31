import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Preset } from '@/hooks/useExplorer2State'
import { cn } from '@/lib/utils'
import { PRESET_INFO } from './labels'

const ORDER: Preset[] = ['equal', 'expert', 'mission_ops', 'learned']

/** Dimension-weight presets. Rankings and the selected place re-score instantly. */
export function PresetPicker({ value, onChange }: { value: Preset; onChange: (p: Preset) => void }) {
  return (
    <div>
      <p className="label-mono mb-1">Dimension weights</p>
      <div role="radiogroup" aria-label="Dimension weights" className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-ink-950/60 p-1">
        {ORDER.map((p) => (
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
