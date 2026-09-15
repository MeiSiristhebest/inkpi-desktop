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
  /** 当前是否有正在防抖等待存盘的变更 */
  hasPending: () => boolean
  /** 立即取消尚未触发的存盘定时器 */
  cancel: () => void
}

export type ChapterAutosaveErrorHandler = (error: unknown, chapter: ChapterRecord) => void

/**
 * 章节自动存盘切片（副作用隔离与耐久性保障）：
 * 管理防抖定时器与 pendingChapter 引用，提供 schedule、cancel 以及关键操作前的原子 flush。
 */
export function useChapterAutosave(
  flush: (chapter: ChapterRecord) => void | Promise<void>,
  onError?: ChapterAutosaveErrorHandler,
): ChapterAutosave {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingChapter = useRef<ChapterRecord | null>(null)

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    pendingChapter.current = null
  }, [])

  const flushInternal = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const chapterToSave = pendingChapter.current
    pendingChapter.current = null
    if (chapterToSave) {
      try {
        await Promise.resolve(flush(chapterToSave))
      } catch (error: unknown) {
        onError?.(error, chapterToSave)
      }
    }
  }, [flush, onError])

  const flushChapter = useCallback(
    async (chapterId: string): Promise<void> => {
      if (pendingChapter.current && pendingChapter.current.id === chapterId) {
        await flushInternal()
      }
    },
    [flushInternal],
  )

  const hasPending = useCallback((): boolean => {
    return pendingChapter.current !== null
  }, [])

  const schedule = useCallback(
    (chapter: ChapterRecord, delayMs?: number) => {
      pendingChapter.current = chapter
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () => {
          timer.current = null
          const toFlush = pendingChapter.current
          pendingChapter.current = null
          if (toFlush) {
            void Promise.resolve(flush(toFlush)).catch((error: unknown) => {
              onError?.(error, toFlush)
            })
          }
        },
        Math.max(200, delayMs ?? AUTOSAVE_MS),
      )
    },
    [flush, onError],
  )

  return { schedule, flush: flushInternal, flushChapter, hasPending, cancel }
}
