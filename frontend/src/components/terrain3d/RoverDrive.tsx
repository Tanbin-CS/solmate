/**
 * The rover drive inside the 3D terrain view: a Perseverance-class rover (procedural model at
 * NASA's published size), its live readouts and the tilt chart. Everything reads one input, the
 * distance driven, through lib/rover.ts.
 */
import { useMemo } from 'react'
import { CylinderGeometry, Quaternion, Vector3 } from 'three'
import { climbTo, GRAVITY, hoursAtTopSpeed, ROVER, ROVER_SCALE, wheelLoadN, type BodyId, type RoverPose, type TiltStatus, type Traverse } from '@/lib/rover'

const STATUS_COLOR: Record<TiltStatus, string> = {
  ok: '#a7c46a',
  avoid: '#f0bb6e',
  tip: '#e05d5d',
  'no-data': '#7d8b9c',
}
const STATUS_TEXT: Record<TiltStatus, string> = {
  ok: 'under NASA’s 30° driving limit',
  avoid: 'over 30°: NASA drivers avoid this',
  tip: 'past the 45° NASA design limit',
  'no-data': 'no terrain data',
}

const R = ROVER.wheelDiameterM / 2
const WHEEL_X = [1.1, 0, -1.1]
const TRACK = ROVER.widthM / 2 - 0.2

/** A thin strut from a to b (metres, rover frame). */
function Strut({ a, b, r = 0.05 }: { a: [number, number, number]; b: [number, number, number]; r?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new Vector3(...a)
    const vb = new Vector3(...b)
    const dir = vb.clone().sub(va)
    return {
      pos: va.clone().add(vb).multiplyScalar(0.5),
      quat: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()),
      len: dir.length(),
    }
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color="#c9d3de" roughness={0.5} />
    </mesh>
  )
}

const WHEEL = new CylinderGeometry(R, R, 0.4, 20)
WHEEL.rotateX(Math.PI / 2)

/** One side of the rocker-bogie: the rocker joins the front wheel to the body pivot and the bogie; the bogie carries the middle and rear wheels. */
function Suspension({ side }: { side: 1 | -1 }) {
  const z = side * (TRACK - 0.25)
  const front: [number, number, number] = [WHEEL_X[0]!, R, z]
  const mid: [number, number, number] = [WHEEL_X[1]!, R, z]
  const rear: [number, number, number] = [WHEEL_X[2]!, R, z]
  const pivot: [number, number, number] = [0.2, 0.8, z]
  const bogie: [number, number, number] = [-0.55, 0.55, z]
  return (
    <group>
      <Strut a={front} b={pivot} />
      <Strut a={pivot} b={bogie} />
      <Strut a={bogie} b={mid} />
      <Strut a={bogie} b={rear} />
    </group>
  )
}

/** Perseverance-class rover at NASA's size (3 m long, 2.7 m wide, 2.2 m tall, 52.5 cm wheels), in metres. */
export function RoverModel({ status }: { status: TiltStatus }) {
  return (
    <group>
      {WHEEL_X.flatMap((x) =>
        [1, -1].map((s) => (
          <mesh key={`${x}${s}`} geometry={WHEEL} position={[x, R, s * TRACK]} castShadow>
            <meshStandardMaterial color="#8a96a6" roughness={0.7} />
          </mesh>
        )),
      )}
      <Suspension side={1} />
      <Suspension side={-1} />
      {/* body */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[2.1, 0.45, 1.65]} />
        <meshStandardMaterial color="#e8edf2" roughness={0.55} />
      </mesh>
      {/* power source at the back */}
      <mesh position={[-1.2, 1.15, 0]} rotation={[0, 0, Math.PI / 3]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.7, 12]} />
        <meshStandardMaterial color="#5d6b7d" roughness={0.6} />
      </mesh>
      {/* mast and head */}
      <mesh position={[0.75, 1.65, 0.45]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
        <meshStandardMaterial color="#c9d3de" roughness={0.5} />
      </mesh>
      <mesh position={[0.78, 2.1, 0.45]} castShadow>
        <boxGeometry args={[0.25, 0.2, 0.55]} />
        <meshStandardMaterial color="#e8edf2" roughness={0.5} />
      </mesh>
      {/* status ring: the one accent, it changes with the tilt */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.5, 48]} />
        <meshBasicMaterial color={STATUS_COLOR[status]} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

const f0 = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : '–')
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '–')

/** Live readouts for one block at the current distance. */
export function DriveCard({
  label,
  body,
  color,
  pose,
  trip,
  lit,
}: {
  label: string
  body: BodyId
  color: string
  pose: RoverPose
  trip: Traverse
  /** sunlight at the rover's spot from the ground inside this block; null without data */
  lit: boolean | null
}) {
  const load = wheelLoadN(body)
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="flex items-center gap-2 text-[12px] font-medium text-slate-200">
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="font-mono text-3xl tabular tracking-tight text-slate-100">
          {f1(pose.tiltDeg)}
          <span className="text-base text-slate-400">° tilt</span>
        </p>
        <p className="text-right font-mono text-[11px]" style={{ color: STATUS_COLOR[pose.status] }}>
          {STATUS_TEXT[pose.status]}
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-slate-400">
        <dt>nose up / down</dt>
        <dd className="text-right tabular text-slate-200">{f1(pose.pitchDeg)}°</dd>
        <dt>side tilt</dt>
        <dd className="text-right tabular text-slate-200">{f1(pose.rollDeg)}°</dd>
        <dt>climbed so far</dt>
        <dd className="text-right tabular text-slate-200">{f0(climbTo(trip, pose.s))} m</dd>
        <dt>sun at the rover (slider sun)</dt>
        <dd className="text-right tabular text-slate-200">{lit === null ? '–' : lit ? 'in sun' : 'in shadow'}</dd>
        <dt>weight per wheel, flat ground</dt>
        <dd className="text-right tabular text-slate-200">
          {f0(load)} N <span className="text-slate-500">(g {GRAVITY[body]} m/s²)</span>
        </dd>
        <dt>whole line: steepest tilt</dt>
        <dd className="text-right tabular text-slate-200">{f0(trip.maxTiltDeg)}°</dd>
        <dt>whole line: over 30°</dt>
        <dd className="text-right tabular text-slate-200">{Number.isFinite(trip.avoidShare) ? `${Math.round(trip.avoidShare * 100)}%` : '–'}</dd>
      </dl>
    </div>
  )
}

/** Tilt along the whole drive line for both blocks, with NASA's 30° and 45° limits and the rover's position. */
export function TiltChart({ trips, s }: { trips: { trip: Traverse; color: string; label: string }[]; s: number }) {
  const W = 600
  const H = 110
  const length = trips[0]?.trip.lengthKm ?? 20
  const top = Math.max(50, ...trips.map((t) => t.trip.maxTiltDeg).filter(Number.isFinite))
  const y = (deg: number) => H - (deg / top) * (H - 6)
  const x = (km: number) => (km / length) * W
  const path = (t: Traverse) =>
    t.poses
      .map((p, i) =>
        Number.isFinite(p.tiltDeg) ? `${i === 0 || !Number.isFinite(t.poses[i - 1]!.tiltDeg) ? 'M' : 'L'}${x(p.s).toFixed(1)},${y(p.tiltDeg).toFixed(1)}` : '',
      )
      .join('')
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Rover tilt along the drive line for both blocks, with the 30 and 45 degree limits"
      >
        {[ROVER.driveLimitDeg, ROVER.tipLimitDeg].map((lim) => (
          <line
            key={lim}
            x1={0}
            x2={W}
            y1={y(lim)}
            y2={y(lim)}
            stroke={lim === ROVER.tipLimitDeg ? STATUS_COLOR.tip : STATUS_COLOR.avoid}
            strokeDasharray="4 4"
            strokeWidth={1}
            opacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--ink-600)" vectorEffect="non-scaling-stroke" />
        {trips.map((t) => (
          <path key={t.label} d={path(t.trip)} fill="none" stroke={t.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={x(s)} x2={x(s)} y1={0} y2={H} stroke="#e8edf2" strokeWidth={1} opacity={0.8} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10.5px] text-slate-400">
        <span>west · 0 km</span>
        <span>
          rover tilt along the line · dashed: <span style={{ color: STATUS_COLOR.avoid }}>30° drivers avoid</span>,{' '}
          <span style={{ color: STATUS_COLOR.tip }}>45° design limit</span>
        </span>
        <span>{length.toFixed(0)} km · east</span>
      </figcaption>
    </figure>
  )
}

/** Shared line under the cards: what the numbers mean and where they come from. */
export function DriveNote({ s, onMoon }: { s: number; onMoon: boolean }) {
  return (
    <p className="text-[11px] leading-relaxed text-slate-500">
      {ROVER.name}: {ROVER.massKg.toLocaleString('en')} kg, {ROVER.wheels} wheels of {ROVER.wheelDiameterM * 100} cm, top speed {ROVER.topSpeedMPerH} m per
      hour, so {s.toFixed(1)} km takes {f0(hoursAtTopSpeed(s))} hours of driving. Drawn {ROVER_SCALE}× its real size. Tilt is the slope of 100 m NASA terrain
      under the rover: rocks and ripples are smoothed out, so tilts at rover scale can be steeper or gentler. Weight per wheel is the rover’s weight in each
      world’s gravity shared by six wheels on flat ground, not a suspension model. The sun is the one set by the sliders, not a real date, and shadows count
      only hills inside the 20 km block. {onMoon && 'Perseverance is a Mars rover; the same rover drives both blocks so they compare fairly. '}
      <a href={ROVER.source} target="_blank" rel="noreferrer noopener" className="text-slate-300 underline underline-offset-2 hover:text-slate-100">
        NASA rover facts
      </a>
    </p>
  )
}
