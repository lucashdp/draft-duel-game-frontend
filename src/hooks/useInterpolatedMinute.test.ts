import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInterpolatedMinute } from './useInterpolatedMinute'

describe('useInterpolatedMinute', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns serverMinute when serverMinute is non-null', () => {
    const at = new Date().toISOString()
    const { result } = renderHook(() => useInterpolatedMinute(30, at))
    expect(result.current).toBe(30)
  })

  it('returns null when serverMinute is null', () => {
    const { result } = renderHook(() => useInterpolatedMinute(null, null))
    expect(result.current).toBeNull()
  })

  it('advances minute after 60 seconds tick', () => {
    const at = new Date().toISOString()
    const { result } = renderHook(() => useInterpolatedMinute(30, at))
    expect(result.current).toBe(30)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe(31)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe(32)
  })
})
