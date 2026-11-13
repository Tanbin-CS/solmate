import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTarget } from './load'

describe('loadTarget', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('refuses ids that are not plain target names, without fetching', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const id of ['../secret', 'https://evil.example/x', 'jezero/../../a', '', 'Jezero']) {
      await expect(loadTarget(id)).rejects.toThrow(/Unknown target/)
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})
