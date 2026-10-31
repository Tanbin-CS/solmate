/// <reference lib="webworker" />
/**
 * Scoring worker: fetches the NASA stack tile under a place and runs the v2 science
 * (identical to the Python screen) off the main thread, so the globe stays smooth.
 */
import { z } from 'zod'
import { PlaceQuerySchema, scorePlace, type PlaceQuery, type PlaceResult } from '@/science/v2/place'

export type WorkerRequest = { id: number; query: PlaceQuery }
export type WorkerResponse = { id: number; ok: true; result: PlaceResult } | { id: number; ok: false; error: string }

const RequestSchema = z.object({ id: z.number().int().nonnegative(), query: PlaceQuerySchema })

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<unknown>) => {
  // A dedicated worker only hears the page that created it; refuse anything else.
  if (e.origin !== '' && e.origin !== self.location.origin) return
  const req = RequestSchema.safeParse(e.data)
  if (!req.success) {
    const id = typeof (e.data as { id?: unknown })?.id === 'number' ? (e.data as { id: number }).id : -1
    self.postMessage({ id, ok: false, error: 'invalid scoring request' } satisfies WorkerResponse)
    return
  }
  const { id, query } = req.data
  scorePlace(query).then(
    (result) => self.postMessage({ id, ok: true, result } satisfies WorkerResponse),
    (err: unknown) => self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'scoring failed' } satisfies WorkerResponse),
  )
}
