import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChapterAutosave } from './useChapterAutosave'
import type { ChapterRecord } from '../../../types'

describe('useChapterAutosave Single-Writer Coalescing Queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces rapid drafts during in-flight save and executes next save sequentially', async () => {
    let resolveSaveA: () => void
    const savePromiseA = new Promise<void>((resolve) => {
      resolveSaveA = resolve
    })

    const saveCalls: ChapterRecord[] = []
    const flush = vi.fn((chapter: ChapterRecord) => {
      saveCalls.push(chapter)
      if (saveCalls.length === 1) {
        return savePromiseA
      }
      return Promise.resolve()
    })

    const { result } = renderHook(() => useChapterAutosave(flush))

    const draftA: ChapterRecord = {
      id: 'ch-1',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: '输入 A',
      order: 1,
      wordCount: 4,
      status: 'draft',
      revision: 10,
      createdAt: 1000,
      updatedAt: 1000,
    }

    const draftB: ChapterRecord = {
      ...draftA,
      content: '输入 A + B',
      wordCount: 7,
    }

    // 1. 触发 Draft A 调度，并推进时间让 A 开始持久化
    act(() => {
      result.current.schedule(draftA, 200)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(flush).toHaveBeenCalledTimes(1)
    expect(saveCalls[0].content).toBe('输入 A')

    // 2. 在 A 尚未完成（in-flight）时，用户继续输入 B
    act(() => {
      result.current.schedule(draftB, 200)
    })

    // 3. A 完成持久化
    await act(async () => {
      resolveSaveA!()
      await savePromiseA
    })

    // 4. B 必须被自动拉起落盘，绝不因为并发分叉丢失
    expect(flush).toHaveBeenCalledTimes(2)
    expect(saveCalls[1].content).toBe('输入 A + B')
    expect(result.current.hasPending()).toBe(false)
  })

  it('drain() barrier resolves only after both in-flight and newly scheduled drafts are completed', async () => {
    let resolveSaveA: () => void
    const savePromiseA = new Promise<void>((resolve) => {
      resolveSaveA = resolve
    })

    let resolveSaveB: () => void
    const savePromiseB = new Promise<void>((resolve) => {
      resolveSaveB = resolve
    })

    const saveCalls: ChapterRecord[] = []
    const flush = vi.fn((chapter: ChapterRecord) => {
      saveCalls.push(chapter)
      if (saveCalls.length === 1) return savePromiseA
      if (saveCalls.length === 2) return savePromiseB
      return Promise.resolve()
    })

    const { result } = renderHook(() => useChapterAutosave(flush))

    const draftA: ChapterRecord = {
      id: 'ch-1',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: 'A',
      order: 1,
      wordCount: 1,
      status: 'draft',
      revision: 1,
      createdAt: 1000,
      updatedAt: 1000,
    }
    const draftB: ChapterRecord = {
      ...draftA,
      content: 'A + B',
      wordCount: 3,
    }

    // 1. 触发 A
    act(() => {
      result.current.schedule(draftA, 200)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(flush).toHaveBeenCalledTimes(1)

    // 2. A in-flight 时，用户键入 B
    act(() => {
      result.current.schedule(draftB, 200)
    })

    // 3. 调用 drain()，此时应等待 A 和 B 全部落库
    let drainSettled = false
    let drainPromise: Promise<void>
    act(() => {
      drainPromise = result.current.drain().then(() => {
        drainSettled = true
      })
    })

    expect(drainSettled).toBe(false)

    // 4. A 存盘完成
    await act(async () => {
      resolveSaveA!()
      await savePromiseA
    })

    // 此时 B 正在保存中，drain 尚未 resolve
    expect(flush).toHaveBeenCalledTimes(2)
    expect(drainSettled).toBe(false)

    // 5. B 存盘完成
    await act(async () => {
      resolveSaveB!()
      await savePromiseB
      await drainPromise
    })

    expect(drainSettled).toBe(true)
    expect(result.current.hasPending()).toBe(false)
  })

  it('drain() rejects and stops hot-looping when save fails, resuming on new input', async () => {
    const flush = vi.fn(() => Promise.reject(new Error('IndexedDB CAS error')))
    const onError = vi.fn()

    const { result } = renderHook(() => useChapterAutosave(flush, onError))

    const draftA: ChapterRecord = {
      id: 'ch-1',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: 'A',
      order: 1,
      wordCount: 1,
      status: 'draft',
      revision: 1,
      createdAt: 1000,
      updatedAt: 1000,
    }

    act(() => {
      result.current.schedule(draftA, 200)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // 等待第一轮保存尝试并失败
    await act(async () => {
      await Promise.resolve()
    })

    expect(flush).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)

    // 状态机已阻断：没有新输入时，绝不自旋热循环重试
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(flush).toHaveBeenCalledTimes(1)

    // drain() 必须以持久化错误 reject
    let drainError: unknown = null
    await act(async () => {
      try {
        await result.current.drain()
      } catch (err) {
        drainError = err
      }
    })
    expect(drainError).toBeTruthy()
    expect((drainError as Error).message).toBe('IndexedDB CAS error')

    // 当用户键入新输入后，解冻并允许尝试最新 draft
    const draftB: ChapterRecord = {
      ...draftA,
      content: 'A + new text',
      wordCount: 4,
    }

    act(() => {
      result.current.schedule(draftB, 200)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    await act(async () => {
      await Promise.resolve()
    })

    // 新的 generation 触发了第 2 次保存尝试
    expect(flush).toHaveBeenCalledTimes(2)
  })
})
