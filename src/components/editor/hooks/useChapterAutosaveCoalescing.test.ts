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
})
