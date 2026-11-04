import { describe, expect, it } from 'vitest'
import { MAX_PINS, parsePins, samePlace } from './useExplorer2State'

describe('parsePins', () => {
  it('reads up to three lat,lon pairs and drops invalid ones', () => {
    expect(parsePins('34.95,83.35;bad;-27.45,-68.75;91,0')).toEqual([
      { lat: 34.95, lon: 83.35 },
      { lat: -27.45, lon: -68.75 },
    ])
    expect(parsePins('1,1;2,2;3,3;4,4')).toHaveLength(MAX_PINS)
    expect(parsePins(null)).toEqual([])
  })
})

describe('samePlace', () => {
  it('matches the same 0.1 degree screening cell, not its neighbour', () => {
    expect(samePlace({ lat: 34.95, lon: 83.35 }, { lat: 34.9501, lon: 83.35 })).toBe(true)
    expect(samePlace({ lat: 34.95, lon: 83.35 }, { lat: 35.05, lon: 83.35 })).toBe(false)
  })
})
