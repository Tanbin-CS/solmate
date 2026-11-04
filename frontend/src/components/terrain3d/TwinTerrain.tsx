/**
 * Side-by-side 3D terrain: a 20 km block of the Earth place next to a 20 km block of the target,
 * same scale, same sun, same vertical exaggeration. Lazy-loaded (three.js) from the place panel.
 * Context only: what you see here never feeds the Analog Index.
 */
import { useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'
import { Loader2 } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
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

function Block({ d, x, exag, colour, row, accent }: { d: Loaded; x: number; exag: number; colour: Colour; row: number; accent: string }) {
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
    </group>
  )
}

function Sun({ elevation, azimuth }: { elevation: number; azimuth: number }) {
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
      shadow-camera-left={-28}
      shadow-camera-right={28}
      shadow-camera-top={16}
      shadow-camera-bottom={-16}
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

export default function TwinTerrain({ earth, target, earthLat }: Props) {
  const [data, setData] = useState<{ a: Loaded; b: Loaded } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exag, setExag] = useState<(typeof EXAG)[number]>(2)
  const [colour, setColour] = useState<Colour>('slope')
  const lowSun = target.body === 'moon'
  const [sunEl, setSunEl] = useState(lowSun ? 2 : 35)
  const [sunAz, setSunAz] = useState(135)
  const [row, setRow] = useState(0.5)
  const noon = Math.round(90 - Math.abs(earthLat))

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

  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
        <div className="space-y-3">
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
          {data && <Profile a={{ d: data.a, side: earth }} b={{ d: data.b, side: target }} row={row} />}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard side={earth} d={data?.a ?? null} />
        <StatCard side={target} d={data?.b ?? null} />
      </div>
    </div>
  )
}
