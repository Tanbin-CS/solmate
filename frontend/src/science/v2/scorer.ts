/**
 * Main-thread handle to the scoring worker. One worker per page; requests are matched
 * to replies by id. Falls back to scoring on the main thread where workers are missing.
 */
import type { WorkerRequest, WorkerResponse } from '@/workers/score.worker'
import type { PlaceQuery, PlaceResult } from './place'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: PlaceResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    worker = new Worker(new URL('../../workers/score.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.ok) p.resolve(e.data.result)
      else p.reject(new Error(e.data.error))
    }
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('scoring worker failed'))
      pending.clear()
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

/** Score a clicked point or a drawn box against one target (and rank every target). */
export async function score(query: PlaceQuery): Promise<PlaceResult> {
  const w = getWorker()
  if (!w) {
    const { scorePlace } = await import('./place')
    return scorePlace(query)
  }
  const id = nextId++
  return new Promise<PlaceResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, query } satisfies WorkerRequest)
  })
}
