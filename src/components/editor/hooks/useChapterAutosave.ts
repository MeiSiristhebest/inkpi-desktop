import { useRef, useCallback } from 'react'
import type { ChapterRecord } from '../../../types'

const AUTOSAVE_MS = 800 // 兜底默认值；实际以 settings.autoSaveDelay 为准

export interface ChapterAutosave {
  /** 防抖调度一次存盘；delayMs 缺省则用 AUTOSAVE_MS */
  schedule: (chapter: ChapterRecord, delayMs?: number) => void
  /** 立即取消尚未触发的存盘定时器 */
  cancel: () => void
}

/**
 * 章节自动存盘切片（副作用隔离）：
 * 仅管理防抖定时器这一项副作用，触发时回调外部传入的 flush（真正落库）。
 * 把「何时存」与「怎么存」分离，便于在视图层外单测与替换。
 */
export function useChapterAutosave(
  flush: (chapter: ChapterRecord) => void | Promise<void>,
): ChapterAutosave {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const schedule = useCallback(
    (chapter: ChapterRecord, delayMs?: number) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () => {
          timer.current = null
          void flush(chapter)
        },
        Math.max(200, delayMs ?? AUTOSAVE_MS),
      )
    },
    [flush],
  )

  return { schedule, cancel }
}
