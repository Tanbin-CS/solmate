import { Mountain, Satellite } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layer } from '@/hooks/useExplorerState'
import { ROLE } from './roles'

export function LayerToggle({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={layer}
      onValueChange={(v) => v && onChange(v as Layer)}
      className="surface rounded-full p-1"
      aria-label="Map layer"
    >
      <ToggleGroupItem value="imagery" className="h-8 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-ink-900">
        <Satellite className="size-3.5" /> Imagery
      </ToggleGroupItem>
      <ToggleGroupItem value="terrain" className="h-8 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-ink-900">
        <Mountain className="size-3.5" /> 3D terrain
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function MapLegend() {
  return (
    <div className="surface flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-full px-4 py-2 text-[11px] text-slate-300">
      {(['documented', 'candidate', 'control'] as const).map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full border-2"
            style={{ borderColor: ROLE[r].color, borderStyle: r === 'control' ? 'dashed' : 'solid' }}
            aria-hidden="true"
          />
          {ROLE[r].short}
        </span>
      ))}
      <span className="hidden text-slate-400 sm:inline">· number = rank · dashed square = 20 km window</span>
    </div>
  )
}
