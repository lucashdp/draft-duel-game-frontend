import { describe, expect, it } from 'vitest'
import { isSafeRedirectPath } from './auth'

describe('isSafeRedirectPath', () => {
  it.each([
    ['/', true],
    ['/me', true],
    ['/championships/copa-2026', true],
    ['/rooms/abc?from=x', true],
  ])('accepts safe path %s', (path, expected) => {
    expect(isSafeRedirectPath(path)).toBe(expected)
  })

  it.each([
    ['', false],
    ['//evil.com', false],
    ['///evil.com', false],
    ['https://evil.com', false],
    ['http://evil.com', false],
    ['javascript:alert(1)', false],
    ['data:text/html,foo', false],
    ['me', false], // missing leading slash
    ['\\\\evil.com', false],
  ])('rejects unsafe path %s', (path, expected) => {
    expect(isSafeRedirectPath(path)).toBe(expected)
  })

  it('rejects null/undefined', () => {
    expect(isSafeRedirectPath(null)).toBe(false)
    expect(isSafeRedirectPath(undefined)).toBe(false)
  })
})
