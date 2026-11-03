import { describe, expect, it } from 'vitest'
import model from '../../../public/data/v2/model.json'
import targets from '../../../public/data/v2/targets.json'
import validation from '../../../public/data/v2/validation.json'
import { DIMENSION_CARDS } from '@/components/home/dimensions'
import { distanceKm, huntStars, LEVELS, mapToLatLon, passMark } from './content'
import { EMPTY, isComplete, isUnlocked, parseProgress, type Progress } from './progress'
import { LENGTH, SCENES, sceneAt } from './scenes'

const ids = targets.targets.map((t) => t.id)
const text = JSON.stringify(LEVELS)

describe('lesson content', () => {
  it('has six levels with unique ids and badges', () => {
    expect(LEVELS).toHaveLength(6)
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(6)
    expect(new Set(LEVELS.map((l) => l.badge)).size).toBe(6)
  })

  it('gives every question exactly one valid, unique answer', () => {
    for (const q of LEVELS.flatMap((l) => l.quiz)) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThan(q.options.length)
      expect(q.explain.length).toBeGreaterThan(10)
    }
    expect(LEVELS.flatMap((l) => l.quiz).length).toBeGreaterThanOrEqual(20)
  })

  it('plays every one of the 11 targets in exactly one round', () => {
    const played = LEVELS.flatMap((l) => (l.activity?.kind === 'rounds' ? l.activity.rounds.map((r) => r.target) : []))
    expect([...played].sort()).toEqual([...ids].sort())
  })

  it('refers only to targets that exist', () => {
    for (const l of LEVELS)
      for (const c of l.cards) if ('target' in c.visual) expect(ids).toContain(c.visual.target)
  })

  it('states the AUC for Jezero as published', () => {
    const jezero = validation.targets.jezero_crater.auc_equal
    expect(text).toContain(`AUC of ${jezero.toFixed(2)}`)
  })

  it('states the novelty distance and counts as configured', () => {
    expect(text).toContain(`${model.known_analogs.novelty_km} km`)
    expect(text).toContain('nine candidate regions')
    expect(targets.targets.filter((t) => t.body === 'moon')).toHaveLength(9)
    expect(text).toContain('seven')
    expect(DIMENSION_CARDS).toHaveLength(7)
  })

  it('uses only local images', () => {
    for (const c of LEVELS.flatMap((l) => l.cards)) if (c.visual.kind === 'image') expect(c.visual.src).toMatch(/^(data|media)\//)
  })
})

describe('game maths', () => {
  it('turns a map position into latitude and longitude', () => {
    expect(mapToLatLon(0.5, 0.5)).toEqual({ lat: 0, lon: 0 })
    expect(mapToLatLon(0, 0)).toEqual({ lat: 90, lon: -180 })
    expect(mapToLatLon(1, 1)).toEqual({ lat: -90, lon: 180 })
    expect(mapToLatLon(1.2, -0.1)).toEqual({ lat: 90, lon: 180 })
  })

  it('awards stars against the best score', () => {
    expect(huntStars(90, 100)).toBe(3)
    expect(huntStars(80, 100)).toBe(2)
    expect(huntStars(60, 100)).toBe(1)
    expect(huntStars(30, 100)).toBe(0)
    expect(huntStars(50, 0)).toBe(0)
  })

  it('measures great-circle distances', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0)
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(Math.PI * 6371, 0)
  })

  it('passes a quiz at 60%', () => {
    expect(passMark(3)).toBe(2)
    expect(passMark(4)).toBe(3)
    expect(passMark(5)).toBe(3)
  })
})

describe('progress', () => {
  it('starts fresh on missing, broken or tampered data', () => {
    expect(parseProgress(null)).toEqual(EMPTY)
    expect(parseProgress('{')).toEqual(EMPTY)
    expect(parseProgress(JSON.stringify({ version: 2, levels: {} }))).toEqual(EMPTY)
    expect(parseProgress(JSON.stringify({ version: 1, levels: { analogs: { stars: [9] } } }))).toEqual(EMPTY)
    expect(parseProgress(JSON.stringify({ version: 1, levels: { '__proto__': {} } }))).toEqual(EMPTY)
  })

  it('opens levels in order', () => {
    const first = LEVELS[0]!
    const done: Progress = { version: 1, free: {}, levels: { [first.id]: { cards: true, stars: [], quiz: passMark(first.quiz.length) } } }
    expect(isUnlocked(EMPTY, 0)).toBe(true)
    expect(isUnlocked(EMPTY, 1)).toBe(false)
    expect(isComplete(done, first.id)).toBe(true)
    expect(isUnlocked(done, 1)).toBe(true)
    expect(isUnlocked(done, 2)).toBe(false)
  })

  it('needs every round played before a game level is complete', () => {
    const moon = LEVELS.find((l) => l.id === 'moon')!
    const rounds = moon.activity?.kind === 'rounds' ? moon.activity.rounds.length : 0
    const p = (stars: number[]): Progress => ({ version: 1, free: {}, levels: { moon: { cards: true, stars, quiz: moon.quiz.length } } })
    expect(isComplete(p(Array(rounds - 1).fill(3)), 'moon')).toBe(false)
    expect(isComplete(p(Array(rounds).fill(0)), 'moon')).toBe(true)
  })
})

describe('explainer timeline', () => {
  it('covers 0 to 30 seconds with no gaps', () => {
    expect(SCENES[0]!.start).toBe(0)
    expect(SCENES.at(-1)!.end).toBe(LENGTH)
    expect(LENGTH).toBe(30)
    for (let n = 1; n < SCENES.length; n++) expect(SCENES[n]!.start).toBe(SCENES[n - 1]!.end)
  })

  it('finds the scene for any time', () => {
    expect(sceneAt(0)).toBe(0)
    expect(sceneAt(4.99)).toBe(0)
    expect(sceneAt(5)).toBe(1)
    expect(sceneAt(LENGTH)).toBe(SCENES.length - 1)
  })
})
