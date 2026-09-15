import { useRef, useCallback } from 'react'
import type { ChapterRecord } from '../../../types'

const AUTOSAVE_MS = 800 // 兜底默认值；实际以 settings.autoSaveDelay 为准

export interface ChapterAutosave {
  /** 防抖调度一次存盘；delayMs 缺省则用 AUTOSAVE_MS */
  schedule: (chapter: ChapterRecord, delayMs?: number) => void
  /** 立即将当前 pending 的章节触发存盘落库 */
  flush: () => Promise<void>
  /** 如果当前 pending 的正是特定 chapterId，立即存盘 */
  flushChapter: (chapterId: string) => Promise<void>
  /** 当前是否有正在防抖等待存盘或正在持久化的变更 */
  hasPending: () => boolean
  /** 立即取消尚未触发的存盘定时器与队列 */
  cancel: () => void
}

export type ChapterAutosaveErrorHandler = (error: unknown, chapter: ChapterRecord) => void

/**
 * 章节自动存盘切片（单写者 Coalescing Queue 架构）：
 * 彻底解决 Save In-Flight 期间继续键入产生的并发分叉与 CAS 假冲突 (INV-01, INV-02)。
 * 保证最新键入始终排队 rebase 递进保存，绝不丢弃任何中间或最后键入的字符。
 */
export function useChapterAutosave(
  flush: (chapter: ChapterRecord) => void | Promise<void>,
  onError?: ChapterAutosaveErrorHandler,
): ChapterAutosave {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDraft = useRef<ChapterRecord | null>(null)
  const isSaving = useRef(false)
  const generation = useRef(0)
  const savedGeneration = useRef(0)

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    latestDraft.current = null
    isSaving.current = false
  }, [])

  const processQueue = useCallback(async (): Promise<void> => {
    if (isSaving.current) return
    if (!latestDraft.current) return
    if (generation.current === savedGeneration.current) return

    isSaving.current = true
    const currentSnapshot = latestDraft.current
    const currentGen = generation.current

    try {
      await Promise.resolve(flush(currentSnapshot))
      savedGeneration.current = currentGen
    } catch (error: unknown) {
      onError?.(error, currentSnapshot)
    } finally {
      isSaving.current = false
      // 若在保存期间又有新输入到达（generation 增加），立即无缝触发下一轮保存
      if (generation.current > savedGeneration.current && latestDraft.current) {
        void processQueue()
      }
    }
  }, [flush, onError])

  const flushInternal = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    await processQueue()
  }, [processQueue])

  const flushChapter = useCallback(
    async (chapterId: string): Promise<void> => {
      if (latestDraft.current && latestDraft.current.id === chapterId) {
        await flushInternal()
      }
    },
    [flushInternal],
  )

  const hasPending = useCallback((): boolean => {
    return (
      latestDraft.current !== null &&
      (generation.current > savedGeneration.current || isSaving.current)
    )
  }, [])

  const schedule = useCallback(
    (chapter: ChapterRecord, delayMs?: number) => {
      latestDraft.current = chapter
      generation.current += 1

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () => {
          timer.current = null
          void processQueue()
        },
        Math.max(200, delayMs ?? AUTOSAVE_MS),
      )
    },
    [processQueue],
  )

  return { schedule, flush: flushInternal, flushChapter, hasPending, cancel }
}
