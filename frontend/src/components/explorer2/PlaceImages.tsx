import { asset } from '@/lib/asset'
import { gibsWindow } from '@/lib/places'

/** Target windows we have imagery for (20 km, same scale as the Earth windows). */
const TARGET_IMAGES: Readonly<Record<string, { src: string; caption: string }>> = {
  jezero_crater: { src: 'data/quicklooks/jezero-hillshade.webp', caption: 'Jezero · CTX relief' },
  mons_mouton_plateau: { src: 'data/quicklooks/mons-mouton-plateau-hillshade.webp', caption: 'Mons Mouton Plateau · LOLA relief' },
}

function Tile({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-ink-900">
      <img src={asset(src)} alt={alt} className="aspect-square w-full object-cover" />
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
        <Tile src={gibsWindow(lat, lon, 20, 'imagery', 256)} alt="Landsat image of this place" caption="Earth · Landsat" />
        <Tile src={gibsWindow(lat, lon, 20, 'relief', 256)} alt="ASTER GDEM shaded relief of this place" caption="Earth · ASTER relief" />
        {target && <Tile src={target.src} alt={target.caption} caption={target.caption} />}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        NASA/USGS Landsat WELD 1990 and NASA/METI ASTER GDEM via NASA GIBS. Context only, not scored.
      </p>
    </section>
  )
}
