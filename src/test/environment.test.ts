import { describe, expect, it } from 'vitest'

describe('test environment', () => {
  it('supports localStorage operations', () => {
    localStorage.setItem('subclear-test-key', 'ready')

    expect(localStorage.getItem('subclear-test-key')).toBe('ready')

    localStorage.removeItem('subclear-test-key')

    expect(localStorage.getItem('subclear-test-key')).toBeNull()
  })

  it('clears localStorage between tests', () => {
    expect(localStorage.getItem('subclear-test-key')).toBeNull()
  })
})
