import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appcheck = vi.hoisted(() => ({ configured: true, token: vi.fn(async () => 'tok') }))
vi.mock('./appcheck', () => ({
  appCheckConfigured: () => appcheck.configured,
  appCheckToken: appcheck.token,
}))

const { fetchTerrain, warmUp } = await import('./client')

const ok = {
  model_version: 'a70e66b122c2', target_id: 'jezero_crater', lat: 37.05, lon: 86.75, size_km: 20,
  indicators: { slope_median: 2.3 }, similarity: { slope_median: 0.99 }, terrain_score: 0.99,
  cached: false, partial: false, source: 'lpdaac', timings_ms: { total: 3100 },
}
const req = { targetId: 'jezero_crater', lat: 37.05, lon: 86.75 }
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  appcheck.configured = true
  appcheck.token.mockResolvedValue('tok')
  fetchMock = vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('fetchTerrain', () => {
  it('sends the App Check token and a strict body, and validates the answer', async () => {
    const r = await fetchTerrain(req)
    expect(r).toEqual({ ok: true, data: ok })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('/api/v1/terrain')
    expect((init.headers as Record<string, string>)['X-Firebase-AppCheck']).toBe('tok')
    expect(JSON.parse(init.body as string)).toEqual({ target_id: 'jezero_crater', lat: 37.05, lon: 86.75, size_km: 20 })
  })

  it('never calls the network when App Check is not configured or the place is outside ASTER GDEM', async () => {
    appcheck.configured = false
    expect(await fetchTerrain(req)).toMatchObject({ ok: false, reason: 'offline' })
    appcheck.configured = true
    expect(await fetchTerrain({ ...req, lat: -85 })).toMatchObject({ ok: false, reason: 'outside_coverage' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps attestation failure and HTTP errors to typed reasons', async () => {
    appcheck.token.mockRejectedValueOnce(new Error('recaptcha'))
    expect(await fetchTerrain(req)).toMatchObject({ reason: 'rejected' })
    for (const [status, reason] of [[429, 'busy'], [401, 'rejected'], [500, 'error']] as const) {
      fetchMock.mockResolvedValueOnce(new Response('{"detail":"x"}', { status }))
      expect(await fetchTerrain(req)).toMatchObject({ ok: false, reason })
    }
  })

  it('rejects a malformed answer and network failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"terrain_score":"high"}', { status: 200 }))
    expect(await fetchTerrain(req)).toMatchObject({ reason: 'error' })
    fetchMock.mockRejectedValueOnce(new TypeError('network'))
    expect(await fetchTerrain(req)).toMatchObject({ reason: 'error' })
  })

  it('warm-up pings health without a token', () => {
    warmUp()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', expect.objectContaining({ method: 'GET' }))
    expect(appcheck.token).not.toHaveBeenCalled()
  })
})
