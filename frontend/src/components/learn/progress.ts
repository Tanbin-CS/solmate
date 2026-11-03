/**
 * Learner progress, kept only in this browser (localStorage). Nothing is sent anywhere and no
 * personal data is stored. Stored data is untrusted: it is parsed with zod and anything that
 * does not fit starts fresh.
 */
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { LEVELS, passMark } from './content'

const KEY = 'solmate-learn-v1'

const LevelProgressSchema = z.object({
  cards: z.boolean().default(false),
  stars: z.array(z.number().int().min(0).max(3)).max(12).default([]),
  quiz: z.number().int().min(0).max(20).nullable().default(null), // best number of right answers
})
export type LevelProgress = z.infer<typeof LevelProgressSchema>

const ProgressSchema = z.object({
  version: z.literal(1),
  levels: z.record(z.string().regex(/^[a-z]{2,20}$/), LevelProgressSchema),
  free: z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), z.number().int().min(0).max(3)).default({}),
})
export type Progress = z.infer<typeof ProgressSchema>

export const EMPTY: Progress = { version: 1, levels: {}, free: {} }

export function parseProgress(raw: string | null): Progress {
  if (!raw) return EMPTY
  try {
    const r = ProgressSchema.safeParse(JSON.parse(raw))
    return r.success ? r.data : EMPTY
  } catch {
    return EMPTY
  }
}

export function levelOf(p: Progress, id: string): LevelProgress {
  return p.levels[id] ?? { cards: false, stars: [], quiz: null }
}

/** A level is complete when its cards are read, every round played and the quiz passed. */
export function isComplete(p: Progress, levelId: string): boolean {
  const level = LEVELS.find((l) => l.id === levelId)
  if (!level) return false
  const lp = levelOf(p, levelId)
  const rounds = level.activity?.kind === 'rounds' ? level.activity.rounds.length : level.activity ? 1 : 0
  return lp.cards && lp.stars.length >= rounds && lp.quiz !== null && lp.quiz >= passMark(level.quiz.length)
}

/** Levels open in order: each one unlocks when the one before it is complete. */
export function isUnlocked(p: Progress, index: number): boolean {
  return index === 0 || isComplete(p, LEVELS[index - 1]!.id)
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      return parseProgress(localStorage.getItem(KEY))
    } catch {
      return EMPTY // storage blocked (private mode, policy): progress lives for this visit only
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress))
    } catch {
      // ignore: see above
    }
  }, [progress])
  const update = useCallback((levelId: string, change: (lp: LevelProgress) => LevelProgress) => {
    setProgress((p) => ({ ...p, levels: { ...p.levels, [levelId]: change(levelOf(p, levelId)) } }))
  }, [])
  const setFree = useCallback((targetId: string, stars: number) => {
    setProgress((p) => ({ ...p, free: { ...p.free, [targetId]: Math.max(stars, p.free[targetId] ?? 0) } }))
  }, [])
  const reset = useCallback(() => setProgress(EMPTY), [])
  return { progress, update, setFree, reset }
}
