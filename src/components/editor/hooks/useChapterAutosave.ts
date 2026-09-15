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
  /** Drain barrier：等待当前正在进行的落库以及所有已排队的 draft 全部 durable 完成后才 resolve；若失败则 reject */
  drain: () => Promise<void>
  /** 当前是否有正在防抖等待存盘或正在持久化的变更 */
  hasPending: () => boolean
  /** 立即取消尚未触发的存盘定时器与队列，并以取消原因 reject 等待者 */
  cancel: (reason?: unknown) => void
  /** 清除错误阻断状态，允许在发生失败后重试保存 */
  retry: () => Promise<void>
}

export type ChapterAutosaveErrorHandler = (error: unknown, chapter: ChapterRecord) => void

/**
 * 章节自动存盘切片（单写者 Coalescing Queue 架构）：
 * 彻底解决 Save In-Flight 期间继续键入产生的并发分叉与 CAS 假冲突 (INV-01, INV-02)。
 * 保证最新键入始终排队 rebase 递进保存，绝不丢弃任何中间或最后键入的字符。
 * 提供真正的 await autosave.drain() 作为切章与关闭时的落库 barrier。
 */
export function useChapterAutosave(
  flush: (chapter: ChapterRecord) => void | Promise<void>,
  onError?: ChapterAutosaveErrorHandler,
): ChapterAutosave {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDraft = useRef<ChapterRecord | null>(null)
  const isSaving = useRef(false)
  const blockedError = useRef<unknown | null>(null)
  const generation = useRef(0)
  const savedGeneration = useRef(0)
  const drainWaiters = useRef<
    Array<{ targetGen: number; resolve: () => void; reject: (err: unknown) => void }>
  >([])

  const cancel = useCallback((reason?: unknown) => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    latestDraft.current = null
    isSaving.current = false
    blockedError.current = null
    // 以 AbortError 清空并 reject 等待中的 waiters，杜绝伪 resolve
    const waiters = drainWaiters.current
    drainWaiters.current = []
    const cancelError =
      reason ??
      (typeof DOMException !== 'undefined'
        ? new DOMException('Autosave cancelled', 'AbortError')
        : new Error('Autosave cancelled'))
    waiters.forEach((w) => w.reject(cancelError))
  }, [])

  const checkWaiters = useCallback(() => {
    const curSaved = savedGeneration.current
    const remaining: typeof drainWaiters.current = []
    for (const waiter of drainWaiters.current) {
      if (curSaved >= waiter.targetGen && !isSaving.current && !blockedError.current) {
        waiter.resolve()
      } else {
        remaining.push(waiter)
      }
    }
    drainWaiters.current = remaining
  }, [])

  const processQueue = useCallback(async (): Promise<void> => {
    if (isSaving.current) return
    // 若处于失败阻塞状态，且没有比失败批次更新的输入到来，阻断无限自旋重试
    if (blockedError.current) {
      if (generation.current === savedGeneration.current) {
        return
      }
      // 作者键入了新内容（generation 增长），解除 blocked 状态尝试保存最新 draft
      blockedError.current = null
    }

    if (!latestDraft.current) {
      checkWaiters()
      return
    }
    if (generation.current === savedGeneration.current) {
      checkWaiters()
      return
    }

    isSaving.current = true
    const currentSnapshot = latestDraft.current
    const currentGen = generation.current

    try {
      await Promise.resolve(flush(currentSnapshot))
      savedGeneration.current = currentGen
      blockedError.current = null
    } catch (error: unknown) {
      blockedError.current = error
      onError?.(error, currentSnapshot)
      // 若发生持久化失败，通知等待该批次及更早的所有 waiter
      const failedWaiters = drainWaiters.current.filter((w) => w.targetGen <= currentGen)
      drainWaiters.current = drainWaiters.current.filter((w) => w.targetGen > currentGen)
      failedWaiters.forEach((w) => w.reject(error))
    } finally {
      isSaving.current = false
      checkWaiters()
      // 关键状态机规则：仅在非 blockedError 且存在更新输入时才自旋触发下一轮保存
      if (!blockedError.current && generation.current > savedGeneration.current && latestDraft.current) {
        void processQueue()
      }
    }
  }, [flush, onError, checkWaiters])

  const drain = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }

    const targetGen = generation.current
    if (blockedError.current && savedGeneration.current < targetGen) {
      return Promise.reject(blockedError.current)
    }

    if (!isSaving.current && !blockedError.current && (savedGeneration.current >= targetGen || !latestDraft.current)) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      drainWaiters.current.push({ targetGen, resolve, reject })
      void processQueue()
    })
  }, [processQueue])

  const retry = useCallback(async (): Promise<void> => {
    blockedError.current = null
    await drain()
  }, [drain])

  const flushInternal = useCallback(async (): Promise<void> => {
    await drain()
  }, [drain])

  const flushChapter = useCallback(
    async (chapterId: string): Promise<void> => {
      if (latestDraft.current && latestDraft.current.id === chapterId) {
        await drain()
      }
    },
    [drain],
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
      blockedError.current = null

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

  return { schedule, flush: flushInternal, flushChapter, drain, hasPending, cancel, retry }
}
