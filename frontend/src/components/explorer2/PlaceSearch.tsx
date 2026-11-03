import { useId, useMemo, useRef, useState } from 'react'
import { Building2, Crosshair, Flag, Loader2, MapPin, Mountain, Search } from 'lucide-react'
import type { LatLon } from '@/hooks/useExplorer2State'
import { hitTitle, search, useSearchData, type Hit, type HitKind, type SearchOptions } from '@/lib/search'
import { cn } from '@/lib/utils'

const ICON: Record<HitKind, typeof MapPin> = { coords: Crosshair, country: Flag, region: Mountain, site: MapPin, city: Building2 }

/**
 * Search box over the map: type a city, country, region, known analog site or "lat, lon", pick a
 * suggestion with the mouse or the arrow keys and Enter, and the globe flies there and scores it.
 */
interface Props {
  onGo: (p: LatLon, title: string | null) => void
  /** The place the panel shows; when it changes by any other route than this box, the text clears. */
  placeKey?: string | null
  fromSearch?: boolean
  sites?: SearchOptions['sites']
  bestIn?: SearchOptions['bestIn']
}

export function PlaceSearch({ onGo, placeKey = null, fromSearch = false, sites, bestIn }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [used, setUsed] = useState(false)
  const [bad, setBad] = useState(false)
  // A place picked from the list, the map or a drawn box would leave the old name here, as if it were still selected.
  const [seen, setSeen] = useState(placeKey)
  if (placeKey !== seen) {
    setSeen(placeKey)
    if (!fromSearch) {
      setText('')
      setBad(false)
    }
  }
  const data = useSearchData(used)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)

  const hits: Hit[] = useMemo(() => (data ? search(text, data, { sites, bestIn }) : []), [text, data, sites, bestIn])
  const show = open && text.trim().length >= 2
  const loading = show && !data

  const go = (h: Hit | undefined) => {
    if (!h) {
      setBad(text.trim().length > 0)
      return
    }
    setText(h.label)
    setOpen(false)
    setBad(false)
    onGo({ lat: h.lat, lon: h.lon }, hitTitle(h))
    input.current?.blur()
  }

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          go(hits[active] ?? hits[0])
        }}
        className="surface flex h-10 items-center gap-1 rounded-full pl-3 pr-1"
      >
        <Search className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <label htmlFor="goto" className="sr-only">
          Search a place: city, country, region, analog site or latitude, longitude
        </label>
        <input
          ref={input}
          id="goto"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(0)
            setBad(false)
          }}
          onFocus={() => {
            setUsed(true)
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search a place or lat, lon"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && hits[active] ? `${listId}-${active}` : undefined}
          aria-invalid={bad || undefined}
          className={cn('w-40 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-400 sm:w-52', bad && 'text-negative')}
        />
        <button type="submit" className="rounded-full p-2 text-slate-300 hover:bg-ink-700 hover:text-slate-100" aria-label="Go to this place and score it">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
        </button>
      </form>
      {show && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Places"
          className="surface absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-80 min-w-64 overflow-y-auto rounded-xl p-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)]"
        >
          {loading && <li className="px-3 py-2 text-xs text-slate-400">Loading place names…</li>}
          {!loading && hits.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">No place found. Try a city, a country, or “lat, lon”.</li>}
          {hits.map((h, i) => {
            const Icon = ICON[h.kind]
            return (
              <li
                key={`${h.kind}-${h.label}-${h.lat}-${h.lon}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2', i === active ? 'bg-ink-700' : 'hover:bg-ink-800')}
              >
                <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-100">{h.label}</span>
                  <span className="block truncate text-[11px] text-slate-400">{h.detail}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
