import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'

/** Zoom on scroll: the block grows from slightly inset to full size as it reaches the middle of the screen. */
export function ZoomOnScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center 55%'] })
  const scale = useTransform(scrollYProgress, [0, 1], [reduced ? 1 : 0.86, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [reduced ? 1 : 0.35, 1])
  const y = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 60, 0])
  return (
    <motion.div ref={ref} style={{ scale, opacity, y }} className={cn('origin-center will-change-transform', className)}>
      {children}
    </motion.div>
  )
}

/** Parallax: decorative planet discs that drift slower or faster than the page. Purely visual. */
export function ParallaxWorlds({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const slow = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [120, -120])
  const fast = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [260, -260])
  const spin = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-20, 20])
  return (
    <div ref={ref} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <motion.div
        style={{ y: slow, rotate: spin, backgroundImage: `url(${asset('media/mars-2k.webp')})` }}
        className="absolute -right-24 top-10 size-72 rounded-full bg-cover bg-center opacity-25 shadow-[inset_-40px_-20px_80px_rgb(5_8_13/0.95)] blur-[1px] md:size-96"
      />
      <motion.div
        style={{ y: fast, backgroundImage: `url(${asset('media/moon-2k.webp')})` }}
        className="absolute -left-16 bottom-0 size-40 rounded-full bg-cover bg-center opacity-20 shadow-[inset_-24px_-12px_48px_rgb(5_8_13/0.95)] md:size-56"
      />
    </div>
  )
}
