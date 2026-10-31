import { useState } from 'react'
import { MapPin, Mountain, Satellite, SquareDashed } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layer2, LatLon } from '@/hooks/useExplorer2State'
import { cn } from '@/lib/utils'

interface Props {
  layer: Layer2
  onLayer: (l: Layer2) => void
  drawing: boolean
  onDrawing: (on: boolean) => void
  onGo: (p: LatLon) => void
}

/** Map controls: imagery vs relief, draw-a-box mode and a keyboard way to score coordinates. */
export function MapToolbar({ layer, onLayer, drawing, onDrawing, onGo }: Props) {
  const [text, setText] = useState('')
  const [bad, setBad] = useState(false)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = text.split(/[\s,]+/).filter(Boolean).map(Number)
    const ok = v.length === 2 && v.every(Number.isFinite) && Math.abs(v[0]!) <= 90 && Math.abs(v[1]!) <= 180
    setBad(!ok)
    if (ok) onGo({ lat: v[0]!, lon: v[1]! })
  }
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
      <form onSubmit={submit} className="surface flex h-10 items-center gap-1 rounded-full pl-3.5 pr-1">
        <label htmlFor="goto" className="sr-only">
          Score coordinates (latitude, longitude)
        </label>
        <input
          id="goto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="lat, lon"
          inputMode="decimal"
          aria-invalid={bad || undefined}
          className={cn('w-28 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-400', bad && 'text-negative')}
        />
        <button type="submit" className="rounded-full p-2 text-slate-300 hover:bg-ink-700 hover:text-slate-100" aria-label="Score these coordinates">
          <MapPin className="size-3.5" />
        </button>
      </form>
    </div>
  )
}
