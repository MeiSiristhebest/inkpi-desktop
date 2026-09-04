/**
 * 跨插件解耦通信事件总线 (Decoupled Plugin Event Bus)
 *
 * 第一性原理：
 * 各大垂直领域插件（战力沙盘、多历法、因果时间线、契诃夫伏笔、一致性门禁）
 * 之间不发生硬代码级直接耦合，而是通过轻量强类型事件总线进行非阻塞、响应式消息分发与联动。
 */

export type PluginEventType =
  | 'TIMELINE_EVENT_REGISTERED'   // multi-calendar -> timeline-grid
  | 'POWER_BREACH_DETECTED'       // combat-sandbox -> consistency-sentinel
  | 'FORESHADOW_PLANTED'          // chekhov-radar -> promise-ledger
  | 'CODEX_ENTITY_TOUCHED'        // living-codex -> memory-palace
  | 'CHAPTER_CONTENT_AUDITED'     // water-meter / reader-hook -> emotion-curve

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
}

export type PluginEventListener<T extends PluginEventType> = (
  payload: PluginEventPayloads[T]
) => void | Promise<void>

export class PluginEventBus {
  private static instance: PluginEventBus
  private listeners = new Map<PluginEventType, Set<PluginEventListener<any>>>()

  public static getInstance(): PluginEventBus {
    if (!this.instance) {
      this.instance = new PluginEventBus()
    }
    return this.instance
  }

  /**
   * 订阅特定插件事件
   */
  public on<T extends PluginEventType>(type: T, listener: PluginEventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    const bucket = this.listeners.get(type)!
    bucket.add(listener)

    // 返回解绑函数
    return () => {
      bucket.delete(listener)
    }
  }

  /**
   * 广播派发事件
   */
  public emit<T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]): void {
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
   * 清空所有监听器（主要用于单元测试隔离）
   */
  public clear(): void {
    this.listeners.clear()
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
      on: <T extends PluginEventType>(type: T, listener: (payload: PluginEventPayloads[T]) => void) => {
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
  on<T extends PluginEventType>(type: T, listener: (payload: PluginEventPayloads[T]) => void): () => void
}

export const pluginEventBus = PluginEventBus.getInstance()

