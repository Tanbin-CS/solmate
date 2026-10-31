/**
 * Client for the SolMate terrain API (Cloud Run behind Firebase Hosting, same origin).
 *
 * The browser's coarse score is always shown first; this call only refines terrain with
 * 100 m NASA ASTER GDEM data. Every failure resolves to a typed "unavailable" result so the
 * UI can keep the coarse score and say why, never a blank panel.
 */
import { z } from 'zod'
import { asset } from '@/lib/asset'
import { appCheckConfigured, appCheckToken } from './appcheck'

const TIMEOUT_MS = 25_000 // the API's own NASA fetch budget is 20 s and then answers partial

export const TerrainResponseSchema = z.object({
  model_version: z.string(),
  target_id: z.string(),
  lat: z.number(),
  lon: z.number(),
  size_km: z.number(),
  indicators: z.record(z.string(), z.number().nullable()),
  similarity: z.record(z.string(), z.number()),
  terrain_score: z.number().nullable(),
  cached: z.boolean(),
  partial: z.boolean(),
  source: z.string(),
  timings_ms: z.record(z.string(), z.number()),
})
export type TerrainResponse = z.infer<typeof TerrainResponseSchema>

export interface TerrainRequest {
  targetId: string
  lat: number
  lon: number
  sizeKm?: number
}

export type TerrainResult =
  | { ok: true; data: TerrainResponse }
  | { ok: false; reason: 'offline' | 'outside_coverage' | 'busy' | 'rejected' | 'timeout' | 'error'; message: string }

const url = (path: string) => asset(`api/v1/${path}`)

/** Wake a Cloud Run instance while the user is still choosing a place. Fire and forget. */
export function warmUp(): void {
  if (!appCheckConfigured()) return
  fetch(url('health'), { method: 'GET', cache: 'no-store' }).catch(() => undefined)
}

const fail = (reason: Extract<TerrainResult, { ok: false }>['reason'], message: string): TerrainResult => ({ ok: false, reason, message })

export async function fetchTerrain(req: TerrainRequest, signal?: AbortSignal): Promise<TerrainResult> {
  if (!appCheckConfigured()) return fail('offline', 'Fine terrain needs the online service; showing ~1 km terrain.')
  if (Math.abs(req.lat) > 83) return fail('outside_coverage', 'ASTER GDEM covers 83° N to 83° S; showing ~1 km terrain.')
  let token: string
  try {
    token = await appCheckToken()
  } catch {
    return fail('rejected', 'Could not verify this browser for the terrain service; showing ~1 km terrain.')
  }
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const res = await fetch(url('terrain'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': token },
      body: JSON.stringify({ target_id: req.targetId, lat: req.lat, lon: req.lon, size_km: req.sizeKm ?? 20 }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (res.status === 429) return fail('busy', 'The terrain service is busy; try again in a minute.')
    if (res.status === 401 || res.status === 403) return fail('rejected', 'The terrain service did not accept this browser.')
    if (!res.ok) return fail('error', `Terrain refinement failed (HTTP ${res.status}); showing ~1 km terrain.`)
    const parsed = TerrainResponseSchema.safeParse(await res.json())
    return parsed.success ? { ok: true, data: parsed.data } : fail('error', 'Unexpected answer from the terrain service.')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') return fail('timeout', 'NASA terrain took too long; showing ~1 km terrain.')
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return fail('error', 'Could not reach the terrain service; showing ~1 km terrain.')
  }
}
