import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Clock } from '../../../ports/clock'
import { useWritingSessionStats } from './useWritingSessionStats'

describe('useWritingSessionStats', () => {
  const projectId = 'writing-stats-storage-event-test'
  const clockPort: Clock = { now: () => new Date(2026, 9, 13, 12).getTime() }
  const storageKey = 'inkpi-author-stats-writing-stats-storage-event-test-2026-10-13'

  afterEach(() => {
    window.localStorage.removeItem(storageKey)
    vi.restoreAllMocks()
  })

  it('refreshes matching cross-tab word counts and preserves local timing stats', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ sessionWords: 7, writingSeconds: 18, idleSeconds: 4 }),
    )

    const { result, unmount } = renderHook(() =>
      useWritingSessionStats({ projectId, clockPort, isActive: false }),
    )

    expect(result.current).toMatchObject({
      sessionWords: 7,
      writingSeconds: 18,
      idleSeconds: 4,
    })

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'inkpi-author-stats-other-project-2026-10-13',
          newValue: JSON.stringify({ sessionWords: 99 }),
        }),
      )
    })
    expect(result.current.sessionWords).toBe(7)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: storageKey,
          newValue: JSON.stringify({ sessionWords: 12, writingSeconds: 200, idleSeconds: 300 }),
        }),
      )
    })

    expect(result.current).toMatchObject({
      sessionWords: 12,
      writingSeconds: 18,
      idleSeconds: 4,
    })
    unmount()
  })
})
