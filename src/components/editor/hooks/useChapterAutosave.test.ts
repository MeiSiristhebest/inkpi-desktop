import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChapterAutosave } from './useChapterAutosave'
import type { ChapterRecord } from '../../../types'

describe('useChapterAutosave durability contract', () => {
  const fakeChapter: ChapterRecord = {
    id: 'ch-1',
    projectId: 'p1',
    volumeId: 'v1',
    title: '第一章',
    content: '正文内容',
    order: 1,
    wordCount: 4,
    status: 'draft',
    revision: 1,
    createdAt: 1000,
    updatedAt: 1000,
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces schedule and flushes after delay', async () => {
    const flush = vi.fn()
    const { result } = renderHook(() => useChapterAutosave(flush))

    act(() => {
      result.current.schedule(fakeChapter, 500)
    })

    expect(result.current.hasPending()).toBe(true)
    expect(flush).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(flush).toHaveBeenCalledWith(fakeChapter)
    expect(result.current.hasPending()).toBe(false)
  })

  it('immediately flushes pending content when flush() is invoked', async () => {
    const flush = vi.fn()
    const { result } = renderHook(() => useChapterAutosave(flush))

    act(() => {
      result.current.schedule(fakeChapter, 800)
    })

    expect(result.current.hasPending()).toBe(true)

    // Invoke flush before timer expires
    await act(async () => {
      await result.current.flush()
    })

    expect(flush).toHaveBeenCalledWith(fakeChapter)
    expect(result.current.hasPending()).toBe(false)

    // Timer expiring later should not call flush again
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushChapter only flushes if matching target chapterId', async () => {
    const flush = vi.fn()
    const { result } = renderHook(() => useChapterAutosave(flush))

    act(() => {
      result.current.schedule(fakeChapter, 800)
    })

    await act(async () => {
      await result.current.flushChapter('different-ch')
    })
    expect(flush).not.toHaveBeenCalled()
    expect(result.current.hasPending()).toBe(true)

    await act(async () => {
      await result.current.flushChapter('ch-1')
    })
    expect(flush).toHaveBeenCalledWith(fakeChapter)
    expect(result.current.hasPending()).toBe(false)
  })

  it('cancel clears pending timer and pending state', () => {
    const flush = vi.fn()
    const { result } = renderHook(() => useChapterAutosave(flush))

    act(() => {
      result.current.schedule(fakeChapter, 800)
    })
    expect(result.current.hasPending()).toBe(true)

    act(() => {
      result.current.cancel()
    })
    expect(result.current.hasPending()).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(flush).not.toHaveBeenCalled()
  })
})
