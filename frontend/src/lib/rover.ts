/**
 * A Perseverance-class rover driven along the 3D view's drive line. One input, the distance
 * driven, poses the rover and feeds every readout, so the panels cannot disagree with the motion.
 *
 * Rover numbers: NASA, "Perseverance Rover Components",
 * https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/
 * Surface gravity: NASA Planetary Fact Sheets (Earth 9.81, Mars 3.71, Moon 1.62 m/s²).
 *
 * The ground is the 100 m NASA terrain, so tilt here is measured over 100 m: real ground at
 * rover scale (rocks, ripples, crater rims) is rougher, and this tilt is a lower bound.
 */
import type { Grid } from './terrain3d'

export const ROVER = {
  name: 'Perseverance-class rover',
  massKg: 1025,
  lengthM: 3,
  widthM: 2.7,
  heightM: 2.2,
  wheels: 6,
  wheelDiameterM: 0.525,
  /** drivers avoid terrain that would tilt the rover more than this */
  driveLimitDeg: 30,
  /** designed to withstand this tilt in any direction without tipping over */
  tipLimitDeg: 45,
  topSpeedMPerH: 152,
  source: 'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/',
} as const

/** The 3D view draws the rover this many times its real size so it shows on a 20 km block. */
export const ROVER_SCALE = 200

export const GRAVITY = { earth: 9.81, mars: 3.71, moon: 1.62 } as const
export type BodyId = keyof typeof GRAVITY

export type TiltStatus = 'ok' | 'avoid' | 'tip' | 'no-data'

export function tiltStatus(tiltDeg: number): TiltStatus {
  if (!Number.isFinite(tiltDeg)) return 'no-data'
  if (tiltDeg >= ROVER.tipLimitDeg) return 'tip'
  if (tiltDeg > ROVER.driveLimitDeg) return 'avoid'
  return 'ok'
}

/** Static weight on one wheel on flat ground, in newtons. */
export function wheelLoadN(body: BodyId): number {
  return (ROVER.massKg * GRAVITY[body]) / ROVER.wheels
}

/** Hours to drive a distance at the rover's top speed on flat, hard ground. */
export function hoursAtTopSpeed(km: number): number {
  return (km * 1000) / ROVER.topSpeedMPerH
}

/** Height (m) at fractional grid indices, bilinear; NaN if any corner has no data or the point is outside. */
export function heightAt(g: Grid, row: number, col: number): number {
  const { n, z } = g
  if (row < 0 || col < 0 || row > n - 1 || col > n - 1) return NaN
  const r0 = Math.min(n - 2, Math.floor(row))
  const c0 = Math.min(n - 2, Math.floor(col))
  const fr = row - r0
  const fc = col - c0
  const a = z[r0 * n + c0]!
  const b = z[r0 * n + c0 + 1]!
  const c = z[(r0 + 1) * n + c0]!
  const d = z[(r0 + 1) * n + c0 + 1]!
  return (a * (1 - fc) + b * fc) * (1 - fr) + (c * (1 - fc) + d * fc) * fr
}

export interface RoverPose {
  /** distance from the west edge, km */
  s: number
  /** grid indices of the rover */
  row: number
  col: number
  heightM: number
  /** nose up positive (driving east), degrees */
  pitchDeg: number
  /** south side up positive, degrees */
  rollDeg: number
  /** combined tilt from level, degrees */
  tiltDeg: number
  status: TiltStatus
}

/** Rover pose at distance s (km) along grid row `row`, heading east; slopes over one grid cell each side. */
export function poseAt(g: Grid, row: number, s: number): RoverPose {
  const lengthKm = ((g.n - 1) * g.cell) / 1000
  const col = Math.min(g.n - 1, Math.max(0, (s / lengthKm) * (g.n - 1)))
  const h = heightAt(g, row, col)
  const dx = 2 * g.cell
  const east = heightAt(g, row, Math.min(g.n - 1, col + 1))
  const west = heightAt(g, row, Math.max(0, col - 1))
  const south = heightAt(g, Math.min(g.n - 1, row + 1), col)
  const north = heightAt(g, Math.max(0, row - 1), col)
  const ex = (Math.min(g.n - 1, col + 1) - Math.max(0, col - 1)) * g.cell || dx
  const ey = (Math.min(g.n - 1, row + 1) - Math.max(0, row - 1)) * g.cell || dx
  const tp = (east - west) / ex
  const tr = (south - north) / ey
  const deg = (v: number) => (Math.atan(v) * 180) / Math.PI
  const tiltDeg = deg(Math.hypot(tp, tr))
  return { s, row, col, heightM: h, pitchDeg: deg(tp), rollDeg: deg(tr), tiltDeg, status: tiltStatus(tiltDeg) }
}

export interface Traverse {
  /** poses every `stepKm` along the line */
  poses: RoverPose[]
  stepKm: number
  lengthKm: number
  /** total height gained going east, m (descents not subtracted) */
  climbM: number
  maxTiltDeg: number
  /** share of the line where drivers would avoid the tilt (over 30 degrees) */
  avoidShare: number
}

/** The whole drive along one row, sampled every 50 m. */
export function traverse(g: Grid, row: number, stepKm = 0.05): Traverse {
  const lengthKm = ((g.n - 1) * g.cell) / 1000
  const poses: RoverPose[] = []
  for (let s = 0; s <= lengthKm + 1e-9; s += stepKm) poses.push(poseAt(g, row, s))
  let climbM = 0
  let maxTiltDeg = 0
  let avoid = 0
  let valid = 0
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i]!
    if (!Number.isFinite(p.tiltDeg)) continue
    valid++
    maxTiltDeg = Math.max(maxTiltDeg, p.tiltDeg)
    if (p.tiltDeg > ROVER.driveLimitDeg) avoid++
    const prev = poses[i - 1]
    if (prev && Number.isFinite(prev.heightM) && p.heightM > prev.heightM) climbM += p.heightM - prev.heightM
  }
  return { poses, stepKm, lengthKm, climbM, maxTiltDeg, avoidShare: valid ? avoid / valid : NaN }
}

/** Climb so far at distance s (km), from a precomputed traverse. */
export function climbTo(t: Traverse, s: number): number {
  let climb = 0
  const last = Math.min(t.poses.length - 1, Math.floor(s / t.stepKm + 1e-9))
  for (let i = 1; i <= last; i++) {
    const a = t.poses[i - 1]!.heightM
    const b = t.poses[i]!.heightM
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) climb += b - a
  }
  return climb
}

/**
 * Is the rover's spot in sunlight? Marches from the spot toward the sun across the grid and
 * checks whether terrain rises above the sun ray. Only ground inside the 20 km block can cast
 * a shadow here; hills beyond it are not known. Heights are true (not exaggerated).
 */
export function sunlit(g: Grid, row: number, col: number, elevationDeg: number, azimuthDeg: number): boolean | null {
  const h0 = heightAt(g, row, col)
  if (!Number.isFinite(h0)) return null
  if (elevationDeg <= 0) return false
  const az = (azimuthDeg * Math.PI) / 180
  // azimuth clockwise from north: east is +col, north is -row
  const dc = Math.sin(az)
  const dr = -Math.cos(az)
  const rise = Math.tan((elevationDeg * Math.PI) / 180) * g.cell // metres the ray climbs per cell
  for (let k = 0.5; ; k += 0.5) {
    const r = row + dr * k
    const c = col + dc * k
    if (r < 0 || c < 0 || r > g.n - 1 || c > g.n - 1) return true
    const h = heightAt(g, r, c)
    if (Number.isFinite(h) && h > h0 + rise * k + 1) return false
  }
}
