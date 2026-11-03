import { Mountain, Satellite, SquareDashed } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layer2, LatLon } from '@/hooks/useExplorer2State'
import type { SearchOptions } from '@/lib/search'
import { cn } from '@/lib/utils'
import { PlaceSearch } from './PlaceSearch'

interface Props {
  layer: Layer2
  onLayer: (l: Layer2) => void
  drawing: boolean
  onDrawing: (on: boolean) => void
  /** Fly to a searched place; title is the searched name when it should head the place panel. */
  onGo: (p: LatLon, title: string | null) => void
  /** The place the panel shows, and whether it came from the search box (else the search text is cleared). */
  placeKey: string | null
  fromSearch: boolean
  sites?: SearchOptions['sites']
  bestIn?: SearchOptions['bestIn']
}

/** Map controls: imagery vs relief, draw-a-box mode and a search for places or coordinates. */
export function MapToolbar({ layer, onLayer, drawing, onDrawing, onGo, placeKey, fromSearch, sites, bestIn }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <ToggleGroup type="single" value={layer} onValueChange={(v) => v && onLayer(v as Layer2)} className="surface rounded-full p-1" aria-label="Map layer">
        <ToggleGroupItem value="imagery" className="h-8 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-ink-900">
          <Satellite className="size-3.5" /> Landsat
        </ToggleGroupItem>
        <ToggleGroupItem value="terrain" className="h-8 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-ink-900">
          <Mountain className="size-3.5" /> ASTER relief 3D
        </ToggleGroupItem>
      </ToggleGroup>
      <button
        type="button"
        aria-pressed={drawing}
        onClick={() => onDrawing(!drawing)}
        className={cn('surface inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs transition-colors', drawing ? 'text-data' : 'text-slate-300 hover:text-slate-100')}
        title="Click two opposite corners on the map"
      >
        <SquareDashed className="size-3.5" /> {drawing ? 'Click two corners' : 'Draw box'}
      </button>
      <PlaceSearch onGo={onGo} placeKey={placeKey} fromSearch={fromSearch} sites={sites} bestIn={bestIn} />
    </div>
  )
}
