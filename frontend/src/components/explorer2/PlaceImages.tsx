import type { ReactNode } from 'react'
import { GibsImage } from '@/components/common/GibsImage'
import { asset } from '@/lib/asset'
import { worldviewUrl } from '@/lib/gibs'

/** Target windows we have imagery for (20 km, same scale as the Earth windows). */
const TARGET_IMAGES: Readonly<Record<string, { src: string; caption: string }>> = {
  jezero_crater: { src: 'data/quicklooks/jezero-hillshade.webp', caption: 'Jezero · CTX relief' },
  mons_mouton_plateau: { src: 'data/quicklooks/mons-mouton-plateau-hillshade.webp', caption: 'Mons Mouton Plateau · LOLA relief' },
}

function Tile({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-ink-900">
      {children}
      <figcaption className="truncate px-2 py-1 font-mono text-[11px] text-slate-400" title={caption}>
        {caption}
      </figcaption>
    </figure>
  )
}

/** Compare data and images: 20 km NASA windows of the place, next to the target where available. */
export function PlaceImages({ lat, lon, targetId }: { lat: number; lon: number; targetId: string }) {
  const target = TARGET_IMAGES[targetId]
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-medium text-slate-200">Images, 20 km across</h3>
      <div className="grid grid-cols-3 gap-2">
        <Tile caption="Earth · Landsat">
          <GibsImage lat={lat} lon={lon} km={20} kind="imagery" alt="Landsat image of this place" className="aspect-square w-full bg-ink-800" />
        </Tile>
        <Tile caption="Earth · ASTER relief">
          <GibsImage lat={lat} lon={lon} km={20} kind="relief" alt="ASTER GDEM shaded relief of this place" className="aspect-square w-full bg-ink-800" />
        </Tile>
        {target && (
          <Tile caption={target.caption}>
            <img src={asset(target.src)} alt={target.caption} className="aspect-square w-full object-cover" />
          </Tile>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        NASA/USGS Landsat WELD 1990 and NASA/METI ASTER GDEM via NASA GIBS. Context only, not scored.{' '}
        <a href={worldviewUrl(lat, lon, 100)} target="_blank" rel="noreferrer" className="text-data hover:underline">
          Open this place in NASA Worldview<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </section>
  )
}
