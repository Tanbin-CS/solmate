import { describe, expect, it } from 'vitest'
import { isStaleChunk, threeDFailure } from './errors'

describe('error helpers', () => {
  it('recognises a missing code chunk after a deploy in each browser', () => {
    expect(isStaleChunk(new TypeError('Failed to fetch dynamically imported module: https://x/assets/TwinTerrain-abc.js'))).toBe(true) // Chrome
    expect(isStaleChunk(new TypeError('Importing a module script failed.'))).toBe(true) // Safari
    expect(isStaleChunk(new TypeError('error loading dynamically imported module'))).toBe(true) // Firefox
    expect(isStaleChunk(new Error('WebGL context lost'))).toBe(false)
  })

  it('tells a stale page from a graphics failure', () => {
    expect(threeDFailure(new TypeError('Importing a module script failed.'))).toMatch(/Reload the page/)
    expect(threeDFailure(new Error('Error creating WebGL context.'))).toMatch(/could not start on this device/)
  })
})
