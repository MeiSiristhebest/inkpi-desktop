/**
 * 跨插件解耦通信事件总线 (Decoupled Plugin Event Bus)
 *
 * 第一性原理：
 * 各大垂直领域插件（战力沙盘、多历法、因果时间线、契诃夫伏笔、一致性门禁、记忆宫殿、读者感知）
 * 之间不发生硬代码级直接耦合，而是通过轻量强类型事件总线进行非阻塞、响应式消息分发与联动。
 */

export type PluginEventType =
  | 'TIMELINE_EVENT_REGISTERED' // multi-calendar -> timeline-grid
  | 'POWER_BREACH_DETECTED' // combat-sandbox -> consistency-sentinel
  | 'FORESHADOW_PLANTED' // chekhov-radar -> promise-ledger
  | 'PROMISE_STATUS_CHANGED' // promise-ledger -> chekhov-radar
  | 'CODEX_ENTITY_TOUCHED' // living-codex -> memory-palace
  | 'CHAPTER_CONTENT_AUDITED' // water-meter / reader-hook -> emotion-curve
  | 'EMOTIONAL_CURVE_UPDATED' // timeline-grid -> emotion-curve
  | 'UNIFIED_CHAPTER_EVALUATED' // 章节质量统一评估流 (rhythm-radar + reader-hook + paywall-sentry)

export interface PluginEventPayloads {
  TIMELINE_EVENT_REGISTERED: {
    projectId: string
    chapterId: string
    calendarId: string
    universalAbsoluteDay: number
    summary: string
  }
  POWER_BREACH_DETECTED: {
    projectId: string
    protagonistName: string
    enemyName: string
    tierDiff: number
    riskLevel: 'WARNING' | 'CRITICAL_COLLAPSE'
    diagnostic: string
  }
  FORESHADOW_PLANTED: {
    projectId: string
    gunName: string
    plantChapterOrder: number
    category: string
  }
  PROMISE_STATUS_CHANGED: {
    projectId: string
    promiseId: string
    status: 'planted' | 'progressing' | 'paid_off' | 'abandoned'
    targetChapter: number
  }
  CODEX_ENTITY_TOUCHED: {
    projectId: string
    entityId: string
    entityName: string
    category: string
  }
  CHAPTER_CONTENT_AUDITED: {
    projectId: string
    chapterId: string
    wordCount: number
    waterScore?: number
  }
  EMOTIONAL_CURVE_UPDATED: {
    projectId: string
    points: Array<{ chapter: number; averagePolarity: number }>
  }
  UNIFIED_CHAPTER_EVALUATED: {
    projectId: string
    chapterId: string
    compositeScore: number
    pacingRating: string
    cliffhangerScore: number
  }
}

export type PluginEventListener<T extends PluginEventType> = (
  payload: PluginEventPayloads[T],
) => void | Promise<void>

export class PluginEventBus {
  private static instance: PluginEventBus
  private listeners = new Map<PluginEventType, Set<PluginEventListener<any>>>()
  // 环形事件历史回放缓冲区 (Replay Buffer): 按事件类型保留最近 N 条，解决懒加载/抽屉未激活时序错位
  private replayBuffer = new Map<PluginEventType, Array<any>>()
  private static readonly MAX_REPLAY_HISTORY = 10

  public static getInstance(): PluginEventBus {
    if (!this.instance) {
      this.instance = new PluginEventBus()
    }
    return this.instance
  }

  /**
   * 订阅特定插件事件，并自动回放匹配的最新事件 (Replay)
   */
  public on<T extends PluginEventType>(type: T, listener: PluginEventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    const bucket = this.listeners.get(type)!
    bucket.add(listener)

    // 回放缓冲区历史事件给新订阅者
    const buffered = this.replayBuffer.get(type)
    if (buffered && buffered.length > 0) {
      for (const item of buffered) {
        try {
          listener(item)
        } catch (err) {
          console.warn(`[PluginEventBus] Error replaying event ${type}:`, err)
        }
      }
    }

    // 返回解绑函数
    return () => {
      bucket.delete(listener)
    }
  }

  /**
   * 广播派发事件，并将事件存入 Replay 缓冲区
   */
  public emit<T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]): void {
    // 写入 Replay Buffer
    if (!this.replayBuffer.has(type)) {
      this.replayBuffer.set(type, [])
    }
    const buffer = this.replayBuffer.get(type)!
    buffer.push(payload)
    if (buffer.length > PluginEventBus.MAX_REPLAY_HISTORY) {
      buffer.shift()
    }

    const bucket = this.listeners.get(type)
    if (!bucket || bucket.size === 0) return

    for (const fn of bucket) {
      try {
        fn(payload)
      } catch (err) {
        console.warn(`[PluginEventBus] Error handling event ${type}:`, err)
      }
    }
  }

  /**
   * 清空所有监听器与回放缓冲区（主要用于单元测试隔离）
   */
  public clear(): void {
    this.listeners.clear()
    this.replayBuffer.clear()
  }

  /**
   * 创建或获取绑定至指定租户（projectId）的作用域事件总线
   */
  public scopedBus(projectId: string): ScopedPluginEventBus {
    return {
      projectId,
      emit: <T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]) => {
        this.emit(type, { ...payload, projectId })
      },
      on: <T extends PluginEventType>(
        type: T,
        listener: (payload: PluginEventPayloads[T]) => void,
      ) => {
        return this.on(type, (payload: any) => {
          if (payload && payload.projectId === projectId) {
            listener(payload)
          }
        })
      },
    }
  }
}

export interface ScopedPluginEventBus {
  projectId: string
  emit<T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]): void
  on<T extends PluginEventType>(
    type: T,
    listener: (payload: PluginEventPayloads[T]) => void,
  ): () => void
}

export const pluginEventBus = PluginEventBus.getInstance()
