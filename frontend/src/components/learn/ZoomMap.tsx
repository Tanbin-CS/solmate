import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { Expand, Minus, Plus } from 'lucide-react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'
import { mapPos, type LatLon } from './content'


const MAX_SCALE = 8
const SPRING = { type: 'spring', stiffness: 220, damping: 32, mass: 0.9 } as const

/**
 * A world map you can zoom and pan like a real map: drag to move, pinch or Ctrl+scroll to zoom,
 * double-tap to zoom in, and +/- buttons. A tap that does not move places the pin. Everything runs on
 * transforms, so it stays smooth on phones. Children are drawn on the map (use `mapPos`); wrap
 * anything that should keep its size in <Upright>.
 */
export function ZoomMap({
  onTap,
  onKey,
  fit,
  label,
  describedBy,
  children,
  className,
}: {
  onTap: (p: LatLon) => void
  onKey?: (e: React.KeyboardEvent) => void
  /** Animate the view to show these points; a new array starts a new flight. */
  fit?: LatLon[] | null
  label: string
  describedBy?: string
  children?: (scale: MotionValue<number>) => ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const s = useMotionValue(1)
  const [hint, setHint] = useState(false)

  // the smallest zoom that still covers the box (a tall phone box shows part of the world)
  const minScale = useCallback(() => (size.w ? Math.max(1, size.h / (size.w / 2)) : 1), [size])
  const clamp = useCallback(
    (nx: number, ny: number, ns: number) => {
      const sc = Math.min(MAX_SCALE, Math.max(minScale(), ns))
      const W = size.w * sc
      const H = (size.w / 2) * sc
      return { x: Math.min(0, Math.max(size.w - W, nx)), y: Math.min(0, Math.max(size.h - H, ny)), s: sc }
    },
    [size, minScale],
  )
  const set = useCallback(
    (v: { x: number; y: number; s: number }, smooth = false) => {
      const c = clamp(v.x, v.y, v.s)
      if (smooth && !reduced) {
        void animate(x, c.x, SPRING)
        void animate(y, c.y, SPRING)
        void animate(s, c.s, SPRING)
      } else {
        x.set(c.x)
        y.set(c.y)
        s.set(c.s)
      }
    },
    [clamp, reduced, x, y, s],
  )
  /** Zoom to scale ns keeping the screen point (px, py) still. */
  const zoomAt = useCallback(
    (px: number, py: number, ns: number, smooth = false) => {
      const sc = Math.min(MAX_SCALE, Math.max(minScale(), ns))
      const wx = (px - x.get()) / s.get()
      const wy = (py - y.get()) / s.get()
      set({ x: px - wx * sc, y: py - wy * sc, s: sc }, smooth)
    },
    [minScale, set, x, y, s],
  )

  // size: track the box, and start centred on the whole world (or the part of it a phone shows)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect() // measure now; the observer only reports on the next frame
    setSize({ w: r.width, h: r.height })
    const ro = new ResizeObserver(([e]) => {
      if (!e) return
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const first = useRef(true)
  useEffect(() => {
    if (!size.w) return
    const sc = first.current ? minScale() : s.get()
    first.current = false
    // keep the centre of the view where it was
    const cx = (size.w / 2 - x.get()) / s.get()
    const cy = (size.h / 2 - y.get()) / s.get()
    set({ x: size.w / 2 - cx * sc, y: size.h / 2 - cy * sc, s: sc })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  // fly to show the given points
  useEffect(() => {
    if (!fit?.length || !size.w) return
    const W = size.w
    const H = size.w / 2
    const xs = fit.map((p) => ((p.lon + 180) / 360) * W)
    const ys = fit.map((p) => ((90 - p.lat) / 180) * H)
    const bw = Math.max(...xs) - Math.min(...xs)
    const bh = Math.max(...ys) - Math.min(...ys)
    const sc = Math.min(4, (size.w * 0.55) / Math.max(bw, 1), (size.h * 0.55) / Math.max(bh, 1))
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2
    set({ x: size.w / 2 - cx * sc, y: size.h / 2 - cy * sc, s: sc }, true)
  }, [fit, size, set])

  // Ctrl+wheel (and trackpad pinch) zooms; a plain wheel scrolls the page and shows how to zoom
  useEffect(() => {
    const el = box.current
    if (!el) return
    let t = 0
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setHint(true)
        clearTimeout(t)
        t = window.setTimeout(() => setHint(false), 1400)
        return
      }
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, s.get() * Math.exp(-e.deltaY * 0.01))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(t)
    }
  }, [zoomAt, s])

  // pointers: one finger pans (or taps), two fingers pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; pinched: boolean; sx: number; sy: number; x0: number; y0: number; d0: number; s0: number; mx: number; my: number } | null>(null)
  const lastTap = useRef(0)
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const startGesture = () => {
    const pts = [...pointers.current.values()]
    const [a, b] = pts
    const mx = b ? (a!.x + b.x) / 2 : a!.x
    const my = b ? (a!.y + b.y) / 2 : a!.y
    const prev = gesture.current
    gesture.current = {
      moved: prev?.moved ?? false,
      pinched: (prev?.pinched ?? false) || !!b,
      sx: a!.x,
      sy: a!.y,
      x0: x.get(),
      y0: y.get(),
      d0: b ? Math.hypot(a!.x - b.x, a!.y - b.y) : 0,
      s0: s.get(),
      mx,
      my,
    }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border bg-ink-950', className)}>
      <div
        ref={box}
        tabIndex={0}
        role="application"
        aria-label={label}
        aria-describedby={describedBy}
        className="relative aspect-[4/3] w-full cursor-crosshair touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-data/70 sm:aspect-[2/1]"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // the pointer is already gone; the gesture still works without capture
          }
          pointers.current.set(e.pointerId, local(e))
          if (pointers.current.size === 1) gesture.current = null
          startGesture()
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return
          pointers.current.set(e.pointerId, local(e))
          const g = gesture.current
          if (!g) return
          const pts = [...pointers.current.values()]
          if (pts.length >= 2) {
            const [a, b] = pts
            const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
            const mx = (a!.x + b!.x) / 2
            const my = (a!.y + b!.y) / 2
            const ns = Math.min(MAX_SCALE, Math.max(minScale(), (g.s0 * d) / Math.max(g.d0, 1)))
            const wx = (g.mx - g.x0) / g.s0
            const wy = (g.my - g.y0) / g.s0
            set({ x: mx - wx * ns, y: my - wy * ns, s: ns })
            g.moved = true
          } else {
            const p = pts[0]!
            if (Math.hypot(p.x - g.sx, p.y - g.sy) > 6) g.moved = true
            if (g.moved) set({ x: g.x0 + p.x - g.sx, y: g.y0 + p.y - g.sy, s: s.get() })
          }
        }}
        onPointerUp={(e) => {
          const g = gesture.current
          const p = local(e)
          pointers.current.delete(e.pointerId)
          if (pointers.current.size > 0) {
            startGesture() // one finger left after a pinch: keep panning from here
            return
          }
          gesture.current = null
          if (!g || g.moved || g.pinched) return
          const now = performance.now()
          if (now - lastTap.current < 300) {
            lastTap.current = 0
            zoomAt(p.x, p.y, s.get() * 2, true) // double tap
            return
          }
          lastTap.current = now
          const fx = (p.x - x.get()) / (size.w * s.get())
          const fy = (p.y - y.get()) / ((size.w / 2) * s.get())
          const lon = Math.max(-180, Math.min(180, fx * 360 - 180))
          const lat = Math.max(-90, Math.min(90, 90 - fy * 180))
          onTap({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 })
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId)
          gesture.current = null
        }}
        onKeyDown={(e) => {
          if (e.key === '+' || e.key === '=') {
            e.preventDefault()
            zoomAt(size.w / 2, size.h / 2, s.get() * 1.6, true)
          } else if (e.key === '-' || e.key === '_') {
            e.preventDefault()
            zoomAt(size.w / 2, size.h / 2, s.get() / 1.6, true)
          } else onKey?.(e)
        }}
      >
        <motion.div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ x, y, scale: s, width: size.w, height: size.w / 2 }}>
          <img
            src={asset('media/earth-2k.webp')}
            srcSet={`${asset('media/earth-1k.webp')} 1024w, ${asset('media/earth-2k.webp')} 2048w`}
            sizes="2048px"
            alt=""
            draggable={false}
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          {children?.(s)}
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
        <motion.p
          initial={false}
          animate={{ opacity: hint ? 1 : 0, y: hint ? 0 : -6 }}
          className="rounded-full bg-ink-950/90 px-3 py-1.5 text-xs text-slate-100"
          aria-hidden="true"
        >
          Hold Ctrl and scroll to zoom, or use the + and − buttons
        </motion.p>
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-border bg-ink-950/90">
        <MapButton label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, s.get() * 1.8, true)}>
          <Plus />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, s.get() / 1.8, true)}>
          <Minus />
        </MapButton>
        <MapButton label="Show the whole world" onClick={() => set({ x: (size.w - size.w * minScale()) / 2, y: (size.h - (size.w / 2) * minScale()) / 2, s: minScale() }, true)}>
          <Expand />
        </MapButton>
      </div>
    </div>
  )
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex size-10 items-center justify-center border-b border-border text-slate-100 transition-colors last:border-b-0 hover:bg-ink-700 [&_svg]:size-4">
      {children}
    </button>
  )
}

/** Keeps a marker the same size on screen however far the map is zoomed. */
export function Upright({ scale, at, children, className }: { scale: MotionValue<number>; at: LatLon; children: ReactNode; className?: string }) {
  const inv = useTransform(scale, (v) => 1 / v)
  return (
    <motion.div className={cn('pointer-events-none absolute', className)} style={{ ...mapPos(at), scale: inv, transformOrigin: '0 0' }}>
      {children}
    </motion.div>
  )
}
