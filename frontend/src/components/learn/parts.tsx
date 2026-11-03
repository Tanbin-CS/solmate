import { useEffect, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Droplets, Mountain, Search, Snowflake, Sprout, Star, Thermometer, Wind } from 'lucide-react'
import { GibsImage } from '@/components/common/GibsImage'
import type { GibsSpot } from '@/lib/gibs'
import { cn } from '@/lib/utils'

export function Stars({ n, size = 'size-5', label = true, pop = false }: { n: number; size?: string; label?: boolean; pop?: boolean }) {
  const reduced = useReducedMotion()
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? 'img' : undefined} aria-label={label ? `${n} of 3 stars` : undefined} aria-hidden={label ? undefined : true}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={pop && !reduced ? { scale: 0, rotate: -40 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: pop ? 0.25 + i * 0.18 : 0, type: 'spring', stiffness: 500, damping: 14 }}
          className="inline-flex"
        >
          <Star className={cn(size, i < n ? 'fill-reference text-reference' : 'text-ink-500')} />
        </motion.span>
      ))}
    </span>
  )
}
/** A picture for each clue, picked from its words. */
function ClueIcon({ text }: { text: string }) {
  const t = text.toLowerCase()
  const Icon = /°c|temperature|swing/.test(t)
    ? Thermometer
    : /cold|frost|ice|freez/.test(t)
      ? Snowflake
      : /dry|rain|water|river/.test(t)
        ? Droplets
        : /plant/.test(t)
          ? Sprout
          : /dust|wind|air/.test(t)
            ? Wind
            : /bare|grey|sand|rock|mineral|mountain|rim|crater|plain|flat|landing|pole/.test(t)
              ? Mountain
              : Search
  return <Icon className="size-4 shrink-0 text-data" aria-hidden="true" />
}

export function Clues({ clues }: { clues: string[] }) {
  const reduced = useReducedMotion()
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Clues">
      {clues.map((c, i) => (
        <motion.li
          key={c}
          initial={reduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduced ? 0 : 0.08 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-2.5 rounded-xl border border-border bg-ink-800 px-3.5 py-2.5 text-[14px] leading-snug text-slate-100"
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-data/10">
            <ClueIcon text={c} />
          </span>
          {c}
        </motion.li>
      ))}
    </ul>
  )
}
export function CountUp({ to, className }: { to: number; className?: string }) {
  const reduced = useReducedMotion()
  const v = useMotionValue(reduced ? to : 0)
  const text = useTransform(v, (n) => String(Math.round(n)))
  useEffect(() => {
    if (reduced) return v.set(to)
    const c = animate(v, to, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [to, reduced, v])
  return <motion.span className={className}>{text}</motion.span>
}
/** A NASA GIBS picture that fades in when it arrives (GIBS can take a few seconds). */
export function SatImage({ spot, alt }: { spot: GibsSpot; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  return (
    <>
      {state !== 'ready' && (
        <span className={cn('absolute inset-0 flex items-center justify-center text-xs text-slate-400', state === 'loading' && 'animate-pulse bg-ink-800')}>
          {state === 'loading' ? 'Loading picture…' : 'Picture not available'}
        </span>
      )}
      <GibsImage
        {...spot}
        alt={alt}
        onState={setState}
        className={cn('h-full w-full transition-[opacity,transform] duration-500 group-hover:scale-[1.04]', state === 'ready' ? 'opacity-100' : 'opacity-0')}
      />
    </>
  )
}
