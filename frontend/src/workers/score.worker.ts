/// <reference lib="webworker" />
/**
 * Scoring worker: fetches the NASA stack tile under a place and runs the v2 science
 * (identical to the Python screen) off the main thread, so the globe stays smooth.
 */
import { scorePlace, type PlaceQuery, type PlaceResult } from '@/science/v2/place'

export type WorkerRequest = { id: number; query: PlaceQuery }
export type WorkerResponse = { id: number; ok: true; result: PlaceResult } | { id: number; ok: false; error: string }

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, query } = e.data
  scorePlace(query).then(
    (result) => self.postMessage({ id, ok: true, result } satisfies WorkerResponse),
    (err: unknown) => self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'scoring failed' } satisfies WorkerResponse),
  )
}
