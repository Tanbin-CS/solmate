/**
 * Side-by-side 3D terrain: a 20 km block of the Earth place next to a 20 km block of the target,
 * same scale, same sun, same vertical exaggeration. Lazy-loaded (three.js) from the place panel.
 * Context only: what you see here never feeds the Analog Index.
 */
import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'
import { Loader2, Pause, Play } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { poseAt, ROVER_SCALE, sunlit, traverse, type BodyId, type RoverPose } from '@/lib/rover'
import { DriveCard, DriveNote, RoverModel, TiltChart } from './RoverDrive'
import { loadGrid, rowProfile, SAFE_DEG, slopeDeg, slopeStats, type Grid, type GridMeta, type SlopeStats } from '@/lib/terrain3d'

export interface TwinSide {
  meta: GridMeta
  label: string
  body: 'earth' | 'moon' | 'mars'
}

interface Props {
  earth: TwinSide
  target: TwinSide
  /** latitude of the Earth place, for its noon sun */
  earthLat: number
  /** home page: only the two drive scenes, the tilt chart and one line of readouts */
  compact?: boolean
  /** hold the drive while the view is off screen (home page) */
  paused?: boolean
}

const BODY_COLOR = {
  earth: '#7fd8e6',
  moon: '#c9d3de',
  mars: '#d9785a',
} as const
const BLOCK_KM = 20
const GAP_KM = 3
const OFFSET = (BLOCK_KM + GAP_KM) / 2

// Slope ramp: easy ground in calm teal, steep ground in warm reds.
const SLOPE_STOPS: [number, Color][] = [
  [0, new Color('#1d5a63')],
  [5, new Color('#3f9c8f')],
  [SAFE_DEG, new Color('#a7c46a')],
  [20, new Color('#f0bb6e')],
  [30, new Color('#d9785a')],
  [45, new Color('#9c3a3a')],
]
const NO_DATA = new Color('#1f2d42')

function slopeColor(s: number, out: Color): Color {
  if (!Number.isFinite(s)) return out.copy(NO_DATA)
  for (let i = 1; i < SLOPE_STOPS.length; i++) {
    const [b, cb] = SLOPE_STOPS[i]!
    if (s <= b) {
      const [a, ca] = SLOPE_STOPS[i - 1]!
      return out.copy(ca).lerp(cb, (s - a) / (b - a))
    }
  }
  return out.copy(SLOPE_STOPS[SLOPE_STOPS.length - 1]![1])
}

interface Loaded {
  grid: Grid
  slope: Float32Array
  stats: SlopeStats
  base: number
}

function prepare(grid: Grid): Loaded {
  const slope = slopeDeg(grid)
  let base = Infinity
  for (const v of grid.z) if (Number.isFinite(v) && v < base) base = v
  return {
    grid,
    slope,
    stats: slopeStats(grid, slope),
    base: Number.isFinite(base) ? base : 0,
  }
}

type Colour = 'slope' | 'height'

function buildGeometry(d: Loaded, exag: number, colour: Colour): BufferGeometry {
  const { n, z } = d.grid
  const pos = new Float32Array(n * n * 3)
  const col = new Float32Array(n * n * 3)
  let hi = 0
  for (const v of z) if (Number.isFinite(v)) hi = Math.max(hi, v - d.base)
  const tmp = new Color()
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const i = r * n + c
      const h = z[i]!
      pos[i * 3] = (c / (n - 1) - 0.5) * BLOCK_KM
      pos[i * 3 + 1] = Number.isFinite(h) ? ((h - d.base) / 1000) * exag : 0
      pos[i * 3 + 2] = (r / (n - 1) - 0.5) * BLOCK_KM
      if (colour === 'slope') slopeColor(d.slope[i]!, tmp)
      else if (!Number.isFinite(h)) tmp.copy(NO_DATA)
      else tmp.setScalar(0.18 + 0.72 * (hi > 0 ? (h - d.base) / hi : 0))
      col[i * 3] = tmp.r
      col[i * 3 + 1] = tmp.g
      col[i * 3 + 2] = tmp.b
    }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6)
  let k = 0
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++) {
      const a = r * n + c
      idx[k++] = a
      idx[k++] = a + n
      idx[k++] = a + 1
      idx[k++] = a + 1
      idx[k++] = a + n
      idx[k++] = a + n + 1
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  g.setIndex(new BufferAttribute(idx, 1))
  g.computeVertexNormals()
  return g
}

function Block({
  d,
  x,
  exag,
  colour,
  row,
  accent,
  rover,
}: {
  d: Loaded
  x: number
  exag: number
  colour: Colour
  row: number
  accent: string
  rover?: RoverPose
}) {
  const geom = useMemo(() => buildGeometry(d, exag, colour), [d, exag, colour])
  useEffect(() => () => geom.dispose(), [geom])
  const line = useMemo(() => {
    const { n, z } = d.grid
    const r = Math.round(row * (n - 1))
    const pts: Vector3[] = []
    for (let c = 0; c < n; c++) {
      const h = z[r * n + c]!
      pts.push(new Vector3((c / (n - 1) - 0.5) * BLOCK_KM, (Number.isFinite(h) ? ((h - d.base) / 1000) * exag : 0) + 0.04, (r / (n - 1) - 0.5) * BLOCK_KM))
    }
    return pts
  }, [d, row, exag])
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>
      <Line points={line} color={accent} lineWidth={2} />
      {rover && Number.isFinite(rover.heightM) && <PlacedRover d={d} exag={exag} pose={rover} />}
    </group>
  )
}

/** Where the rover sits on the block as drawn (km, block frame). */
function roverAt(d: Loaded, exag: number, pose: RoverPose): [number, number, number] {
  const n = d.grid.n
  return [(pose.col / (n - 1) - 0.5) * BLOCK_KM, ((pose.heightM - d.base) / 1000) * exag, (pose.row / (n - 1) - 0.5) * BLOCK_KM]
}

/** The rover on the block as drawn: same exaggeration, so it sits on the displayed slope. */
function PlacedRover({ d, exag, pose }: { d: Loaded; exag: number; pose: RoverPose }) {
  const rad = (deg: number) => Math.atan(exag * Math.tan((deg * Math.PI) / 180))
  return (
    <group position={roverAt(d, exag, pose)} rotation={[-rad(pose.rollDeg), 0, rad(pose.pitchDeg)]} scale={ROVER_SCALE / 1000}>
      <RoverModel status={pose.status} />
    </group>
  )
}

/** Keeps the orbit target on the rover and carries the camera along, so a drag still orbits around it. */
function FollowRover({ to }: { to: [number, number, number] }) {
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: Vector3; update: () => void } | null
  const invalidate = useThree((st) => st.invalidate)
  const [x, y, z] = to
  useEffect(() => {
    if (!controls) return
    const next = new Vector3(x, y, z)
    camera.position.add(next.clone().sub(controls.target))
    controls.target.copy(next)
    controls.update()
    invalidate()
  }, [x, y, z, camera, controls, invalidate])
  return null
}

/** One block with its own camera following its rover (drive view). */
function DriveScene({
  d,
  side,
  exag,
  colour,
  row,
  pose,
  sunEl,
  sunAz,
  lowSun,
  playing,
  onToggle,
  zoom = true,
}: {
  d: Loaded
  side: TwinSide
  exag: number
  colour: Colour
  row: number
  pose: RoverPose
  sunEl: number
  sunAz: number
  lowSun: boolean
  /** shows the play/pause control on this scene when set */
  playing?: boolean
  onToggle?: () => void
  /** off on the home page, so the mouse wheel scrolls the page instead of zooming */
  zoom?: boolean
}) {
  const at = roverAt(d, exag, pose)
  const start = Number.isFinite(at[1]) ? at : ([at[0], 0, at[2]] as [number, number, number])
  return (
    <div className="relative h-[46vh] min-h-72 overflow-hidden rounded-lg border border-border bg-ink-950">
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [start[0] - 2.2, start[1] + 1.6, start[2] + 2.6], fov: 45, near: 0.02, far: 200 }}
        aria-label={`${side.label}: the rover on its 20 km block`}
      >
        <color attach="background" args={['#05080d']} />
        <hemisphereLight args={['#9fb4cc', '#0a1019', lowSun ? 0.12 : 0.35]} />
        <Sun elevation={sunEl} azimuth={sunAz} reach={12} />
        <Block d={d} x={0} exag={exag} colour={colour} row={row} accent={BODY_COLOR[side.body]} rover={pose} />
        <OrbitControls makeDefault enableDamping={false} enableZoom={zoom} maxPolarAngle={Math.PI / 2.05} minDistance={0.6} maxDistance={40} target={start} />
        {Number.isFinite(at[1]) && <FollowRover to={at} />}
      </Canvas>
      <Tag side={side} className="left-3" />
      {onToggle && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <PlayButton playing={!!playing} onToggle={onToggle} overlay />
          <span className="pointer-events-none rounded bg-ink-900/85 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {playing ? 'Driving · drag to look around' : 'Paused · drag to look around'}
          </span>
        </div>
      )}
    </div>
  )
}

/** Play / pause for the drive. Looking around (drag, zoom) never stops it; only this and the distance slider do. */
function PlayButton({ playing, onToggle, overlay = false }: { playing: boolean; onToggle: () => void; overlay?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={playing}
      aria-label={playing ? 'Pause the drive' : 'Play the drive'}
      title={playing ? 'Pause the drive' : 'Play the drive'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
        overlay ? 'border-slate-100/20 bg-ink-900/90 text-slate-100 hover:bg-ink-700' : 'border-border text-slate-200 hover:bg-ink-700'
      }`}
    >
      {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
      {playing ? 'Pause' : 'Play'}
    </button>
  )
}

function Sun({ elevation, azimuth, reach = 28 }: { elevation: number; azimuth: number; reach?: number }) {
  const invalidate = useThree((s) => s.invalidate)
  const el = (elevation * Math.PI) / 180
  const az = (azimuth * Math.PI) / 180
  const dist = 60
  // azimuth clockwise from north; north is -z in the scene
  const pos: [number, number, number] = [dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), -dist * Math.cos(el) * Math.cos(az)]
  useEffect(() => invalidate(), [elevation, azimuth, invalidate])
  return (
    <directionalLight
      position={pos}
      intensity={2.6}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-reach}
      shadow-camera-right={reach}
      shadow-camera-top={Math.min(reach, 16)}
      shadow-camera-bottom={-Math.min(reach, 16)}
      shadow-camera-near={1}
      shadow-camera-far={140}
      shadow-bias={-0.0004}
    />
  )
}

function StatCard({ side, d }: { side: TwinSide; d: Loaded | null }) {
  const s = d?.stats
  const f = (v: number | undefined, unit: string, digits = 1) => (v === undefined || !Number.isFinite(v) ? '–' : `${v.toFixed(digits)}${unit}`)
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="flex items-center gap-2 text-[12px] font-medium text-slate-200">
        <span className="size-2 rounded-full" style={{ background: BODY_COLOR[side.body] }} aria-hidden />
        {side.label}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-slate-400">
        <dt>median slope</dt>
        <dd className="text-right tabular text-slate-200">{f(s?.median, '°')}</dd>
        <dt>steepest 10%</dt>
        <dd className="text-right tabular text-slate-200">{f(s?.p90, '°')}</dd>
        <dt>under {SAFE_DEG}°</dt>
        <dd className="text-right tabular text-slate-200">{s ? `${Math.round(s.gentle * 100)}%` : '–'}</dd>
        <dt>relief</dt>
        <dd className="text-right tabular text-slate-200">{f(s?.relief, ' m', 0)}</dd>
      </dl>
      <p className="mt-2 text-[10.5px] leading-snug text-slate-500">{side.meta.source}</p>
    </div>
  )
}

/** Height along the drive line for both blocks, on one shared scale, with the steepest slope met on it. */
function Profile({ a, b, row }: { a: { d: Loaded; side: TwinSide }; b: { d: Loaded; side: TwinSide }; row: number }) {
  const lines = [a, b].map(({ d, side }) => {
    const p = rowProfile(d.grid, d.slope, row * (d.grid.n - 1))
    const steep = Math.max(0, ...p.map((q) => q.s).filter(Number.isFinite))
    return { p, side, steep }
  })
  const top = Math.max(1, ...lines.flatMap((l) => l.p.map((q) => q.h).filter(Number.isFinite)))
  const W = 600
  const H = 120
  const path = (ps: { x: number; h: number }[]) =>
    ps
      .map((q, i) =>
        Number.isFinite(q.h)
          ? `${i === 0 || !Number.isFinite(ps[i - 1]!.h) ? 'M' : 'L'}${((q.x / BLOCK_KM) * W).toFixed(1)},${(H - (q.h / top) * (H - 8)).toFixed(1)}`
          : '',
      )
      .join('')
  return (
    <figure className="mt-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full"
        role="img"
        aria-label={`Height along the drive line, west to east, both blocks on one scale up to ${Math.round(top)} metres`}
      >
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--ink-600)" />
        {lines.map((l) => (
          <path key={l.side.body} d={path(l.p)} fill="none" stroke={BODY_COLOR[l.side.body]} strokeWidth={1.6} />
        ))}
      </svg>
      <figcaption className="mt-1 space-y-1 font-mono text-[10.5px] text-slate-500">
        <span className="flex justify-between">
          <span>west</span>
          <span>height above the line&apos;s lowest point · top {Math.round(top)} m</span>
          <span>east</span>
        </span>
        {lines.map((l) => (
          <span key={l.side.body} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded" style={{ background: BODY_COLOR[l.side.body] }} aria-hidden />
            {l.side.label}: steepest on the line {l.steep.toFixed(0)}°
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

function Tag({ side, className }: { side: TwinSide; className: string }) {
  return (
    <span
      className={`pointer-events-none absolute top-3 flex items-center gap-1.5 rounded bg-ink-900/85 px-2 py-0.5 font-mono text-[11px] text-slate-200 ${className}`}
    >
      <span className="size-2 rounded-full" style={{ background: BODY_COLOR[side.body] }} aria-hidden />
      {side.label}
    </span>
  )
}

const EXAG = [1, 2, 4] as const

export default function TwinTerrain({ earth, target, earthLat, compact = false, paused = false }: Props) {
  const [data, setData] = useState<{ a: Loaded; b: Loaded } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exag, setExag] = useState<(typeof EXAG)[number]>(2)
  const [colour, setColour] = useState<Colour>('slope')
  const lowSun = target.body === 'moon'
  const [sunEl, setSunEl] = useState(lowSun ? 2 : 35)
  const [sunAz, setSunAz] = useState(135)
  const [row, setRow] = useState(0.5)
  const noon = Math.round(90 - Math.abs(earthLat))
  const [mode, setMode] = useState<'drive' | 'terrain'>('drive')
  const [s, setS] = useState(0)
  const reduced = useReducedMotion() ?? false
  // The rover drives itself from the start (paused for reduced motion). Play/Pause and the distance
  // slider control it; dragging or zooming the view only moves the camera.
  const [playing, setPlaying] = useState(!reduced)

  const trips = useMemo(() => {
    if (!data) return null
    const at = (d: Loaded) => traverse(d.grid, Math.round(row * (d.grid.n - 1)))
    return { a: at(data.a), b: at(data.b) }
  }, [data, row])
  const lengthKm = trips?.a.lengthKm ?? BLOCK_KM
  const poses = useMemo(() => {
    if (!data) return null
    const at = (d: Loaded) => poseAt(d.grid, Math.round(row * (d.grid.n - 1)), s)
    return { a: at(data.a), b: at(data.b) }
  }, [data, row, s])

  useEffect(() => {
    if (mode !== 'drive' || !data || !playing || paused) return
    const speed = lengthKm / 28 // km per second of driving
    let raf = 0
    let prev = performance.now()
    let hold = 0
    const tick = (now: number) => {
      // the first frame time can be earlier than performance.now(), so clamp at zero as well
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000))
      prev = now
      setS((v) => {
        if (v >= lengthKm) {
          // hold 2 s at the east edge, then drive the line again
          hold += dt
          if (hold < 2) return v
          hold = 0
          return 0
        }
        return Math.min(lengthKm, Math.round((v + speed * dt) * 200) / 200)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, data, lengthKm, playing, paused])
  const toggle = () => {
    if (!playing && s >= lengthKm) setS(0) // play at the end starts the line again
    setPlaying((p) => !p)
  }
  /** dragging the distance slider takes the wheel: pause so the rover stays where it is put */
  const scrub = (v: number | undefined) => {
    setPlaying(false)
    setS(v ?? s)
  }

  useEffect(() => {
    let live = true
    Promise.all([loadGrid(earth.meta), loadGrid(target.meta)])
      .then(([a, b]) => live && setData({ a: prepare(a), b: prepare(b) }))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load the 3D terrain'))
    return () => {
      live = false
    }
  }, [earth.meta, target.meta])

  const btn = (on: boolean) =>
    `rounded px-2 py-1 font-mono text-[11px] transition-colors ${on ? 'bg-ink-600 text-slate-100' : 'text-slate-400 hover:bg-ink-700 hover:text-slate-200'}`

  const driving = mode === 'drive' && data && poses && trips
  const targetBody: BodyId = target.body
  if (compact) {
    return (
      <div className="space-y-3">
        {driving ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {(['a', 'b'] as const).map((k) => (
                <DriveScene
                  key={k}
                  d={data[k]}
                  side={k === 'a' ? earth : target}
                  exag={exag}
                  colour={colour}
                  row={row}
                  pose={poses[k]}
                  sunEl={sunEl}
                  sunAz={sunAz}
                  lowSun={lowSun}
                  playing={playing}
                  onToggle={k === 'a' ? toggle : undefined}
                  zoom={false}
                />
              ))}
            </div>
            <TiltChart
              s={s}
              trips={[
                { trip: trips.a, color: BODY_COLOR.earth, label: earth.label },
                { trip: trips.b, color: BODY_COLOR[target.body], label: target.label },
              ]}
            />
            <div className="flex items-center gap-3">
              <PlayButton playing={playing} onToggle={toggle} />
              <Slider aria-label="Distance driven" className="flex-1" min={0} max={lengthKm} step={0.05} value={[s]} onValueChange={([v]) => scrub(v)} />
              <span className="w-16 text-right font-mono text-[11px] tabular text-slate-400">{s.toFixed(1)} km</span>
            </div>
          </>
        ) : (
          <p className="flex h-72 items-center justify-center gap-2 rounded-lg border border-border text-sm text-slate-400" role={error ? 'alert' : undefined}>
            {error ?? (
              <>
                <Loader2 className="size-4 animate-spin" /> Loading NASA terrain…
              </>
            )}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {driving ? (
        <div className="grid gap-3 md:grid-cols-2">
          <DriveScene
            d={data.a}
            side={earth}
            exag={exag}
            colour={colour}
            row={row}
            pose={poses.a}
            sunEl={sunEl}
            sunAz={sunAz}
            lowSun={lowSun}
            playing={playing}
            onToggle={toggle}
          />
          <DriveScene d={data.b} side={target} exag={exag} colour={colour} row={row} pose={poses.b} sunEl={sunEl} sunAz={sunAz} lowSun={lowSun} />
        </div>
      ) : (
        <div className="relative h-[46vh] min-h-72 overflow-hidden rounded-lg border border-border bg-ink-950">
          {error && (
            <p role="alert" className="p-4 text-sm text-negative">
              {error}
            </p>
          )}
          {!data && !error && (
            <p className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" /> Loading NASA terrain…
            </p>
          )}
          {data && (
            <Canvas
              shadows
              frameloop="demand"
              dpr={[1, 1.5]}
              camera={{ position: [0, 17, 27], fov: 42, near: 0.1, far: 400 }}
              aria-label={`3D terrain: ${earth.label} on the left, ${target.label} on the right, 20 km each`}
            >
              <color attach="background" args={['#05080d']} />
              <hemisphereLight args={['#9fb4cc', '#0a1019', lowSun ? 0.12 : 0.35]} />
              <Sun elevation={sunEl} azimuth={sunAz} />
              <Block d={data.a} x={-OFFSET} exag={exag} colour={colour} row={row} accent={BODY_COLOR.earth} />
              <Block d={data.b} x={OFFSET} exag={exag} colour={colour} row={row} accent={BODY_COLOR[target.body]} />
              <OrbitControls makeDefault enableDamping={false} maxPolarAngle={Math.PI / 2.05} minDistance={8} maxDistance={90} target={[0, 0, 0]} />
            </Canvas>
          )}
          {data && (
            <>
              <Tag side={earth} className="left-3" />
              <Tag side={target} className="right-3" />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
        <div className="space-y-3">
          <div>
            <p className="label-mono mb-1">View</p>
            <div className="flex gap-1" role="group" aria-label="What to show">
              <button type="button" className={btn(mode === 'drive')} aria-pressed={mode === 'drive'} onClick={() => setMode('drive')}>
                rover drive
              </button>
              <button type="button" className={btn(mode === 'terrain')} aria-pressed={mode === 'terrain'} onClick={() => setMode('terrain')}>
                terrain only
              </button>
            </div>
          </div>
          <div>
            <p className="label-mono mb-1">Colour</p>
            <div className="flex gap-1" role="group" aria-label="Colour the ground by">
              <button type="button" className={btn(colour === 'slope')} aria-pressed={colour === 'slope'} onClick={() => setColour('slope')}>
                slope
              </button>
              <button type="button" className={btn(colour === 'height')} aria-pressed={colour === 'height'} onClick={() => setColour('height')}>
                height
              </button>
            </div>
            {colour === 'slope' && (
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10.5px] text-slate-500">
                0°
                <span
                  className="h-1.5 w-28 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${SLOPE_STOPS.map(([s, c]) => `#${c.getHexString()} ${(s / 45) * 100}%`).join(', ')})`,
                  }}
                  aria-hidden
                />
                45°+
              </p>
            )}
          </div>
          <div>
            <p className="label-mono mb-1">Height ×</p>
            <div className="flex gap-1" role="group" aria-label="Vertical exaggeration">
              {EXAG.map((e) => (
                <button key={e} type="button" className={btn(exag === e)} aria-pressed={exag === e} onClick={() => setExag(e)}>
                  {e}×
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="label-mono mb-1.5" id="sun-el">
              Sun height · {sunEl}°
            </p>
            <Slider aria-labelledby="sun-el" min={0} max={80} step={1} value={[sunEl]} onValueChange={([v]) => setSunEl(v ?? sunEl)} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button type="button" className={btn(sunEl === 2)} onClick={() => setSunEl(2)}>
                lunar pole · 2°
              </button>
              <button type="button" className={btn(sunEl === noon)} onClick={() => setSunEl(noon)}>
                Earth noon here · {noon}°
              </button>
            </div>
          </div>
          <div>
            <p className="label-mono mb-1.5" id="sun-az">
              Sun direction · {sunAz}°
            </p>
            <Slider aria-labelledby="sun-az" min={0} max={359} step={1} value={[sunAz]} onValueChange={([v]) => setSunAz(v ?? sunAz)} />
          </div>
        </div>

        <div>
          <p className="label-mono mb-1.5" id="drive-row">
            Drive line · {Math.round((1 - row) * BLOCK_KM)} km from the south edge
          </p>
          <Slider aria-labelledby="drive-row" min={0} max={1} step={0.01} value={[row]} onValueChange={([v]) => setRow(v ?? row)} />
          {mode === 'drive' ? (
            <div className="mt-3">
              <p className="label-mono mb-1.5" id="drive-s">
                Distance driven · {s.toFixed(1)} of {lengthKm.toFixed(0)} km
              </p>
              <div className="flex items-center gap-3">
                <PlayButton playing={playing} onToggle={toggle} />
                <Slider aria-labelledby="drive-s" className="flex-1" min={0} max={lengthKm} step={0.05} value={[s]} onValueChange={([v]) => scrub(v)} />
              </div>
            </div>
          ) : (
            data && <Profile a={{ d: data.a, side: earth }} b={{ d: data.b, side: target }} row={row} />
          )}
        </div>
      </div>

      {driving ? (
        <>
          <TiltChart
            s={s}
            trips={[
              { trip: trips.a, color: BODY_COLOR.earth, label: earth.label },
              { trip: trips.b, color: BODY_COLOR[target.body], label: target.label },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <DriveCard
              label={earth.label}
              body="earth"
              color={BODY_COLOR.earth}
              pose={poses.a}
              trip={trips.a}
              lit={sunlit(data.a.grid, poses.a.row, poses.a.col, sunEl, sunAz)}
            />
            <DriveCard
              label={target.label}
              body={targetBody}
              color={BODY_COLOR[target.body]}
              pose={poses.b}
              trip={trips.b}
              lit={sunlit(data.b.grid, poses.b.row, poses.b.col, sunEl, sunAz)}
            />
          </div>
          <DriveNote s={s} onMoon={target.body === 'moon'} />
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard side={earth} d={data?.a ?? null} />
          <StatCard side={target} d={data?.b ?? null} />
        </div>
      )}
    </div>
  )
}
