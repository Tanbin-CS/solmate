import { useMemo, useRef, type CSSProperties } from 'react'
import { gibsTiles, type GibsSpot, type GibsTile } from '@/lib/gibs'
import { cn } from '@/lib/utils'

interface Props extends GibsSpot {
  /** Empty for decoration. */
  alt: string
  /** Size and position come from here; the picture covers the box like object-cover. */
  className?: string
  style?: CSSProperties
  /** 'ready' once every tile has loaded, 'failed' if any tile fails. */
  onState?: (s: 'ready' | 'failed') => void
}

/**
 * A square NASA GIBS window around a point, stitched from WMTS tiles. The tiles sit in a square
 * that covers the box (container units), so any box shape crops like an `object-cover` image.
 */
export function GibsImage({ lat, lon, km, kind, px, alt, className, style, onState }: Props) {
  const tiles = useMemo(() => gibsTiles({ lat, lon, km, kind, px }), [lat, lon, km, kind, px])
  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn('relative overflow-hidden', className)}
      style={{ containerType: 'size', ...style }}
    >
      <Mosaic key={tiles.map((t) => t.url).join()} tiles={tiles} onState={onState} />
    </div>
  )
}

function Mosaic({ tiles, onState }: { tiles: GibsTile[]; onState?: Props['onState'] }) {
  const loaded = useRef(0)
  return (
    <div className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2" style={{ width: 'max(100cqw, 100cqh)' }}>
      {tiles.map((t) => (
        <img
          key={t.url}
          src={t.url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => {
            loaded.current += 1
            if (loaded.current === tiles.length) onState?.('ready')
          }}
          onError={() => onState?.('failed')}
          className="absolute max-w-none select-none"
          // A hair of overlap hides the seams that rounding leaves between tiles.
          style={{ left: `${t.left}%`, top: `${t.top}%`, width: `${t.size + 0.2}%`, height: `${t.size + 0.2}%` }}
        />
      ))}
    </div>
  )
}
