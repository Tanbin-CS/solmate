import { describe, expect, it } from 'vitest'
import { climbTo, heightAt, hoursAtTopSpeed, poseAt, ROVER, sunlit, tiltStatus, traverse, wheelLoadN } from './rover'
import type { Grid } from './terrain3d'

/** n x n grid at 100 m with height f(row, col) in metres. */
function grid(n: number, f: (r: number, c: number) => number): Grid {
  const z = new Float32Array(n * n)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) z[r * n + c] = f(r, c)
  return { n, cell: 100, z }
}

describe('rover numbers', () => {
  it('uses NASA limits: drive below 30 degrees, tips at 45', () => {
    expect(tiltStatus(12)).toBe('ok')
    expect(tiltStatus(30)).toBe('ok')
    expect(tiltStatus(31)).toBe('avoid')
    expect(tiltStatus(45)).toBe('tip')
    expect(tiltStatus(NaN)).toBe('no-data')
  })
  it('puts 2.6 times more weight on each wheel on Earth than on Mars', () => {
    expect(wheelLoadN('earth')).toBeCloseTo((1025 * 9.81) / 6, 6)
    expect(wheelLoadN('earth') / wheelLoadN('mars')).toBeCloseTo(9.81 / 3.71, 6)
    expect(wheelLoadN('moon')).toBeLessThan(wheelLoadN('mars'))
  })
  it('needs about 132 hours for 20 km at 152 m per hour', () => {
    expect(hoursAtTopSpeed(20)).toBeCloseTo(20000 / ROVER.topSpeedMPerH, 6)
  })
})

describe('heightAt', () => {
  it('interpolates between cells and is NaN outside the grid', () => {
    const g = grid(3, (_r, c) => c * 10)
    expect(heightAt(g, 1, 0.5)).toBeCloseTo(5)
    expect(heightAt(g, 2, 2)).toBe(20)
    expect(Number.isNaN(heightAt(g, -0.1, 1))).toBe(true)
  })
})

describe('poseAt', () => {
  it('pitches nose up 45 degrees on ground rising 100 m per 100 m eastward', () => {
    const g = grid(11, (_r, c) => c * 100)
    const p = poseAt(g, 5, 0.5)
    expect(p.pitchDeg).toBeCloseTo(45, 6)
    expect(p.rollDeg).toBeCloseTo(0, 6)
    expect(p.tiltDeg).toBeCloseTo(45, 6)
    expect(p.status).toBe('tip')
  })
  it('rolls south side up on ground rising southward, and combines pitch and roll into tilt', () => {
    const g = grid(11, (r, c) => r * 20 + c * 20)
    const p = poseAt(g, 5, 0.5)
    expect(p.rollDeg).toBeCloseTo((Math.atan(0.2) * 180) / Math.PI, 6)
    expect(p.tiltDeg).toBeCloseTo((Math.atan(Math.hypot(0.2, 0.2)) * 180) / Math.PI, 6)
    expect(p.status).toBe('ok')
  })
  it('clamps the distance to the line', () => {
    const g = grid(11, () => 0)
    expect(poseAt(g, 5, 99).col).toBe(10)
    expect(poseAt(g, 5, -1).col).toBe(0)
  })
})

describe('traverse', () => {
  it('adds up only the climbs and finds the steep share', () => {
    // up 300 m over the first 3 cells, flat, then down
    const g = grid(11, (_r, c) => (c <= 3 ? c * 100 : c <= 6 ? 300 : 300 - (c - 6) * 10))
    const t = traverse(g, 5)
    expect(t.lengthKm).toBeCloseTo(1)
    expect(t.climbM).toBeCloseTo(300, 3)
    expect(t.maxTiltDeg).toBeGreaterThan(40)
    expect(t.avoidShare).toBeGreaterThan(0)
    expect(t.avoidShare).toBeLessThan(0.5)
    expect(climbTo(t, 0.15)).toBeCloseTo(150, 3)
    expect(climbTo(t, 1)).toBeCloseTo(300, 3)
  })
})

describe('sunlit', () => {
  // a 500 m wall along the east edge (col 10), flat ground elsewhere
  const g = grid(11, (_r, c) => (c === 10 ? 500 : 0))
  it('is in shadow when a ridge toward the sun stands above the sun ray', () => {
    // 900 m from the wall at 2 degrees: the ray climbs 31 m, the wall is 500 m
    expect(sunlit(g, 5, 1, 2, 90)).toBe(false)
  })
  it('is in sun when the sun is high enough or on the other side', () => {
    expect(sunlit(g, 5, 1, 60, 90)).toBe(true)
    expect(sunlit(g, 5, 1, 2, 270)).toBe(true)
  })
  it('has no sun below the horizon and no answer without data', () => {
    expect(sunlit(g, 5, 1, 0, 90)).toBe(false)
    expect(sunlit({ n: 3, cell: 100, z: new Float32Array(9).fill(NaN) }, 1, 1, 10, 0)).toBeNull()
  })
})
