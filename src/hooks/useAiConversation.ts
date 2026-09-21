import { useState, useEffect, useRef, useCallback } from 'react'
import { connectToDaemon } from '../core/daemonConnection'
import { inkpiDaemonGateway } from '../adapters/inkpiDaemonGateway'
import type { AiAssistant } from '../ports/aiGateway'
import { IndexedDbArtifactStore, type AiArtifact } from '../ai/artifacts'
import type { Clock } from '../ports/clock'
import { clock } from '../adapters/clock'
import type { ModelConfig } from '../core/settings'
import { DEFAULT_DAEMON_URL } from '../config'
import type { AiTask, TaskResult, TaskStatus, TaskStatusSnapshot } from '@inkpi/protocol'
import { semanticDocumentFromText } from '../domain/content'
import type { StoryState } from '../domain/story'
import {
  createAssistantTask,
  createContinueTask,
  createContinuityAuditTask,
  createDeepReasoningTask,
  createDistillationTask,
} from '../ai/tasks/taskFactories'
import { taskResultText } from '../ai/tasks/pluginTasks'
import { idGenerator } from '../adapters/idGenerator'
import type { DomainSyncConflict, DomainSyncResult } from '../domain/sync/domainSyncService'
import type { ContinuityAuditTaskInput, DeepReasoningTaskInput } from '../ai/tasks/taskFactories'
import type {
  ProjectDistillationInput,
  DistillationWorkflowOptions,
} from '../ai/orchestrator/verticalSlices'
import type { ContinuityFinding, DeepReasoningResult } from '../ai/results/taskResults'
import type { DistillationWorkflowResult } from '../ai/orchestrator/verticalSlices'
import {
  indexedDbTaskRecoveryStore,
  type TaskRecoveryRecord,
  type TaskRecoveryStore,
} from '../db/taskRecoveryStore'
import { bootstrapDesktopTaskRecovery } from '../adapters/desktopTaskRecoveryBootstrap'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { projectContent } from '../domain/content'
import type { ChapterRecord } from '../types'
import type { ActiveWritingContext } from '../core/activeWritingContext'
import { workspaceLifecycleService } from '../services/workspaceLifecycleService'

/**
 * AI 副驾驶会话状态机（§7.3，从 App.tsx 组合根抽离）。
 *
 * 职责：daemon 连接生命周期、按章节的 session 管理、行内续写（Ghost Text）、
 * 自由对话状态机。仅依赖注入的端口（AiGateway / daemonConnection），不直接编排业务以外的副作用。
 * App.tsx 作为组合根只负责把本 hook 的输出接到 <Engine> / <AiAssistantPanel>。
 */

const isTauriContext = (): boolean =>
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

interface AiMessage {
  role: 'user' | 'assistant'
  text: string
}

const RECOVERY_STATUSES: readonly TaskStatus[] = [
  'interrupted',
  'failed',
  'cancelled',
  'waiting-user',
]

const isRecoveryStatus = (status: TaskStatus): boolean => RECOVERY_STATUSES.includes(status)

const isAbortError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')

const errorSnapshot = (error: unknown, code: string) => ({
  code,
  message: error instanceof Error ? error.message : String(error),
})

const recoverySnapshot = (snapshot: TaskStatusSnapshot): TaskStatusSnapshot => ({
  taskId: snapshot.taskId,
  kind: snapshot.kind,
  status: snapshot.status,
  ...(typeof snapshot.progress === 'number' ? { progress: snapshot.progress } : {}),
  ...(snapshot.startedAt === undefined ? {} : { startedAt: snapshot.startedAt }),
  ...(snapshot.finishedAt === undefined ? {} : { finishedAt: snapshot.finishedAt }),
  ...(snapshot.executionRunId ? { executionRunId: snapshot.executionRunId } : {}),
  ...(snapshot.attempts === undefined ? {} : { attempts: snapshot.attempts }),
  ...(snapshot.checkpoint ? { checkpoint: { ...snapshot.checkpoint } } : {}),
  ...(snapshot.error
    ? {
        error: {
          code: snapshot.error.code,
          message: snapshot.error.message,
          ...(snapshot.error.retryable === undefined
            ? {}
            : { retryable: snapshot.error.retryable }),
        },
      }
    : {}),
})

const initialTaskSnapshot = (task: AiTask): TaskStatusSnapshot => ({
  taskId: task.id,
  kind: task.kind,
  status: 'queued',
  attempts: 0,
})

type ActiveTaskOperation = 'task' | 'convenience'
type RecoveryActionKind = 'resume' | 'dismiss'

interface ActiveTask {
  projectId?: string
  controller: AbortController
  task: AiTask
  client: AiAssistant
  operation: ActiveTaskOperation
  identityKey: string
  cancelRequested: boolean
  latestSnapshot: TaskStatusSnapshot
  promise: Promise<unknown>
}

export type DomainSyncState = 'synced' | 'syncing' | 'offline' | 'pending' | 'conflict'

export interface AiConversation {
  isConnected: boolean
  isReconnecting: boolean
  aiPanelOpen: boolean
  setAiPanelOpen: (open: boolean) => void
  aiMessages: AiMessage[]
  aiInput: string
  setAiInput: (value: string) => void
  aiBusy: boolean
  reconnect: () => void
  requestGhost: (chapterId: string, text: string) => Promise<string | null>
  sendAiPrompt: (prompt: string, chapterId?: string) => void
  runAiTask: (task: AiTask) => Promise<TaskResult | null>
  taskRecovery: TaskRecoveryRecord[]
  taskRecoveryLoading: boolean
  taskRecoveryError?: string
  resumeTask: (taskId: string) => Promise<boolean>
  cancelTask: (taskId: string) => Promise<boolean>
  dismissTask: (taskId: string) => Promise<boolean>
  steerTask: (taskId: string, input: unknown) => Promise<boolean>
  runContinuityAudit: (
    input: ContinuityAuditTaskInput,
    options?: Parameters<NonNullable<AiAssistant['runContinuityAudit']>>[1],
  ) => Promise<ContinuityFinding[] | null>
  runDeepReasoning: (
    input: DeepReasoningTaskInput,
    options?: Parameters<NonNullable<AiAssistant['runDeepReasoning']>>[1],
  ) => Promise<DeepReasoningResult | null>
  runDistillationWorkflow: (
    input: ProjectDistillationInput,
    options?: DistillationWorkflowOptions,
  ) => Promise<DistillationWorkflowResult | null>
  runPluginTool: (pluginId: string, input: Record<string, unknown>) => Promise<unknown | null>
  runPluginWorkflow: (
    pluginId: string,
    input: unknown,
    metadata?: Record<string, unknown>,
  ) => Promise<unknown | null>
  syncDomain: (workspaceId: string) => Promise<DomainSyncResult | null>
  listArtifacts: (workspaceId: string) => Promise<AiArtifact[]>
  domainSyncState: DomainSyncState
  syncConflict?: DomainSyncConflict
}

export interface UseAiConversationOptions {
  /** 初始右侧 AI 面板是否开启（默认关闭，保持专注写作） */
  initialPanelOpen?: boolean
  /** 任务恢复存储可注入，便于验证重启/失败/取消路径。 */
  taskRecoveryStore?: TaskRecoveryStore
  /** 时间源可注入，避免恢复快照测试依赖系统时钟。 */
  clock?: Clock
  /** Current authoritative StoryState used when building creative task context. */
  storyState?: StoryState
}

export function useAiConversation(
  wsUrl: string,
  aiModel: ModelConfig | null,
  workspaceId?: string | null,
  options: UseAiConversationOptions = {},
  activeWritingContext?: ActiveWritingContext | null,
): AiConversation {
  const { initialPanelOpen = false, storyState } = options
  const taskStore = options.taskRecoveryStore ?? indexedDbTaskRecoveryStore
  const clockPort = options.clock ?? clock
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [connectionEpoch, setConnectionEpoch] = useState(0)
  const clientRef = useRef<AiAssistant | null>(null)
  const connectionSubscriptionRef = useRef<(() => void) | null>(null)
  const connectionAttemptRef = useRef(0)
  const mountedRef = useRef(false)
  const workspaceIdRef = useRef(workspaceId)
  const activeTasksRef = useRef(new Map<string, ActiveTask>())
  const recoveryRecordsRef = useRef<TaskRecoveryRecord[]>([])
  const recoveryPersistenceQueueRef = useRef(new Map<string, Promise<void>>())
  const recoveryActionPromisesRef = useRef(
    new Map<string, { kind: RecoveryActionKind; promise: Promise<boolean> }>(),
  )
  const recoveryGenerationRef = useRef(0)
  const aiBusyRef = useRef(false)
  const promptRequestRef = useRef(0)

  const [aiPanelOpen, setAiPanelOpen] = useState(initialPanelOpen)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [taskRecovery, setTaskRecovery] = useState<TaskRecoveryRecord[]>([])
  const [taskRecoveryLoading, setTaskRecoveryLoading] = useState(Boolean(workspaceId))
  const [taskRecoveryError, setTaskRecoveryError] = useState<string>()
  const [domainSyncState, setDomainSyncState] = useState<DomainSyncState>('offline')
  const [syncConflict, setSyncConflict] = useState<DomainSyncConflict | undefined>(undefined)

  const replaceRecoveryRecords = useCallback((records: TaskRecoveryRecord[]) => {
    const sorted = [...records].sort((left, right) => right.updatedAt - left.updatedAt)
    recoveryGenerationRef.current += 1
    recoveryRecordsRef.current = sorted
    setTaskRecovery(sorted)
  }, [])

  const upsertRecoveryRecord = useCallback(
    (record: TaskRecoveryRecord) => {
      if (record.projectId !== workspaceIdRef.current) return
      recoveryGenerationRef.current += 1
      const records = recoveryRecordsRef.current.filter((item) => item.task.id !== record.task.id)
      replaceRecoveryRecords([...records, record])
    },
    [replaceRecoveryRecords],
  )

  const removeRecoveryRecord = useCallback(
    (taskId: string, expectedProjectId = workspaceIdRef.current) => {
      if (!mountedRef.current || expectedProjectId !== workspaceIdRef.current) return
      recoveryGenerationRef.current += 1
      replaceRecoveryRecords(
        recoveryRecordsRef.current.filter((record) => record.task.id !== taskId),
      )
    },
    [replaceRecoveryRecords],
  )

  const enqueueRecoveryPersistence = useCallback(
    (record: TaskRecoveryRecord, operation: () => Promise<void>) => {
      const key = `${record.projectId}:${record.task.id}`
      const previous = recoveryPersistenceQueueRef.current.get(key) ?? Promise.resolve()
      let next: Promise<void>
      next = previous
        .catch(() => undefined)
        .then(operation)
        .finally(() => {
          if (recoveryPersistenceQueueRef.current.get(key) === next) {
            recoveryPersistenceQueueRef.current.delete(key)
          }
        })
      recoveryPersistenceQueueRef.current.set(key, next)
      void next.catch((error: unknown) => {
        if (mountedRef.current && record.projectId === workspaceIdRef.current) {
          setTaskRecoveryError(error instanceof Error ? error.message : String(error))
        }
      })
    },
    [],
  )

  const persistRecoveryRecord = useCallback(
    (record: TaskRecoveryRecord) => {
      enqueueRecoveryPersistence(record, () => taskStore.save(record))
    },
    [enqueueRecoveryPersistence, taskStore],
  )

  const removePersistedRecoveryRecord = useCallback(
    (record: TaskRecoveryRecord) => {
      enqueueRecoveryPersistence(record, () => taskStore.remove(record.projectId, record.task.id))
    },
    [enqueueRecoveryPersistence, taskStore],
  )

  const trackTaskSnapshot = useCallback(
    (task: AiTask, snapshot: TaskStatusSnapshot, expectedProjectId = workspaceIdRef.current) => {
      if (!mountedRef.current || expectedProjectId !== workspaceIdRef.current) return
      assertTaskSnapshotIdentity(task, snapshot)
      const projectId = expectedProjectId
      if (!projectId) return
      const record: TaskRecoveryRecord = {
        projectId,
        task,
        snapshot: recoverySnapshot(snapshot),
        updatedAt: clockPort.now(),
      }
      upsertRecoveryRecord(record)
      if (
        isRecoveryStatus(record.snapshot.status) ||
        record.snapshot.status === 'queued' ||
        record.snapshot.status === 'running' ||
        record.snapshot.status === 'checkpointed'
      ) {
        persistRecoveryRecord(record)
      }
    },
    [clockPort, persistRecoveryRecord, upsertRecoveryRecord],
  )

  const initConnection = useCallback(async (url: string = DEFAULT_DAEMON_URL) => {
    const attempt = ++connectionAttemptRef.current
    setIsReconnecting(true)
    let result: Awaited<ReturnType<typeof connectToDaemon>>
    try {
      result = await connectToDaemon(inkpiDaemonGateway, url, {
        isTauri: isTauriContext(),
        shouldAbort: () => !mountedRef.current || connectionAttemptRef.current !== attempt,
      })
    } catch (error: unknown) {
      if (mountedRef.current && connectionAttemptRef.current === attempt) {
        setIsConnected(false)
        setIsReconnecting(false)
        setDomainSyncState('offline')
        console.warn('[InkPi Desktop] Daemon 连接失败:', error)
      }
      return
    }
    if (!mountedRef.current || connectionAttemptRef.current !== attempt) {
      result.client?.close().catch(() => {})
      return
    }
    const previousClient = clientRef.current
    connectionSubscriptionRef.current?.()
    connectionSubscriptionRef.current = null
    clientRef.current = result.client
    if (previousClient && previousClient !== result.client) {
      void previousClient.close().catch(() => {})
    }
    setIsConnected(result.connected)
    setIsReconnecting(false)
    if (!result.connected) {
      setDomainSyncState('offline')
    }
    const subscribeToConnectionState = result.client?.subscribeToConnectionState
    if (subscribeToConnectionState) {
      const client = result.client
      connectionSubscriptionRef.current = subscribeToConnectionState((connected) => {
        if (!mountedRef.current || clientRef.current !== client || connected) return
        connectionSubscriptionRef.current?.()
        connectionSubscriptionRef.current = null
        clientRef.current = null
        setIsConnected(false)
        setIsReconnecting(false)
        setDomainSyncState('offline')
      })
    }
    if (result.connected) {
      setConnectionEpoch((epoch) => epoch + 1)
      if (result.client) {
        void workspaceLifecycleService.processPendingPurgeTombstones(result.client)
      }
    }
    if (!result.connected) {
      console.warn('[InkPi Desktop] Daemon 连接失败，进入离线沙盒模式')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void initConnection(wsUrl)
    return () => {
      mountedRef.current = false
      connectionAttemptRef.current += 1
      promptRequestRef.current += 1
      for (const active of activeTasksRef.current.values()) {
        active.cancelRequested = true
        active.controller.abort()
      }
      activeTasksRef.current.clear()
      connectionSubscriptionRef.current?.()
      connectionSubscriptionRef.current = null
      if (clientRef.current) clientRef.current.close().catch(() => {})
    }
    // 仅在挂载时连接；wsUrl 变化由 reconnect 显式触发（与原 App 行为一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    workspaceIdRef.current = workspaceId
    recoveryGenerationRef.current += 1
    recoveryRecordsRef.current = []
    setTaskRecovery([])
    setTaskRecoveryError(undefined)
    if (!workspaceId) {
      setTaskRecoveryLoading(false)
      return
    }

    let alive = true
    const generation = recoveryGenerationRef.current
    setTaskRecoveryLoading(true)
    const assistant = isConnected ? clientRef.current : null
    const getTaskExecution = assistant?.getTaskExecution
      ? (taskId: string) => assistant.getTaskExecution!(taskId)
      : undefined
    void bootstrapDesktopTaskRecovery({
      projectId: workspaceId,
      store: taskStore,
      clock: clockPort,
      getTaskExecution,
    })
      .then((report) => {
        if (!alive || generation !== recoveryGenerationRef.current) return
        replaceRecoveryRecords(report.records)
        setTaskRecoveryError(
          report.issues.length > 0
            ? report.issues.map((issue) => issue.message).join('; ')
            : undefined,
        )
      })
      .catch((error: unknown) => {
        if (!alive) return
        setTaskRecoveryError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (alive) setTaskRecoveryLoading(false)
      })
    return () => {
      alive = false
    }
  }, [clockPort, connectionEpoch, isConnected, replaceRecoveryRecords, taskStore, workspaceId])

  useEffect(() => {
    const projectId = workspaceId
    return () => {
      for (const active of activeTasksRef.current.values()) {
        if (active.projectId !== projectId) continue
        active.cancelRequested = true
        active.controller.abort()
      }
    }
  }, [workspaceId])

  const executeDomainSync = useCallback(
    async (wId: string): Promise<DomainSyncResult | null> => {
      if (!clientRef.current?.syncDomain || !isConnected) {
        setDomainSyncState('offline')
        return null
      }
      setDomainSyncState('syncing')
      try {
        const result = await clientRef.current.syncDomain(wId)
        if (result.conflict) {
          setDomainSyncState('conflict')
          setSyncConflict(result.conflict)
        } else {
          setDomainSyncState('synced')
          setSyncConflict(undefined)
        }
        return result
      } catch (error) {
        console.warn('[InkPi Desktop] Domain projection sync failed:', error)
        setDomainSyncState('offline')
        return null
      }
    },
    [isConnected],
  )

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      setDomainSyncState('offline')
      return
    }
    void executeDomainSync(workspaceId)
  }, [executeDomainSync, isConnected, workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let syncQueue: Promise<unknown> = Promise.resolve()
    const scheduleSync = () => {
      if (!isConnected || !clientRef.current?.syncDomain) {
        setDomainSyncState(isConnected ? 'pending' : 'offline')
        return
      }
      setDomainSyncState('pending')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        syncQueue = syncQueue.catch(() => undefined).then(() => executeDomainSync(workspaceId))
      }, 100)
    }
    const unsubscribe = domainChangeEvents.subscribe(workspaceId, scheduleSync)
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [executeDomainSync, isConnected, workspaceId])

  const runTrackedTask = useCallback(
    (task: AiTask): Promise<TaskResult | null> => {
      const identityKey = serializeTaskIdentity(task)
      const existing = activeTasksRef.current.get(task.id)
      if (existing) {
        if (existing.operation !== 'task' || existing.identityKey !== identityKey) {
          return Promise.reject(
            new Error(`Task ${task.id} is already active with a different identity`),
          )
        }
        return existing.promise as Promise<TaskResult | null>
      }

      const client = clientRef.current
      if (!client || !isConnected || !client.runTask) return Promise.resolve(null)

      const controller = new AbortController()
      const projectId = workspaceIdRef.current
      const active: ActiveTask = {
        projectId: projectId ?? undefined,
        controller,
        task,
        client,
        operation: 'task',
        identityKey,
        cancelRequested: false,
        latestSnapshot: initialTaskSnapshot(task),
        promise: Promise.resolve(null),
      }
      activeTasksRef.current.set(task.id, active)
      const promise = (async (): Promise<TaskResult | null> => {
        let latestSnapshot = active.latestSnapshot
        trackTaskSnapshot(task, latestSnapshot, projectId)

        try {
          const result = await client.runTask(task, {
            signal: controller.signal,
            onProgress: (snapshot) => {
              if (
                active.cancelRequested ||
                !mountedRef.current ||
                workspaceIdRef.current !== projectId
              )
                return
              assertTaskSnapshotIdentity(task, snapshot)
              latestSnapshot = snapshot
              active.latestSnapshot = snapshot
              trackTaskSnapshot(task, snapshot, projectId)
            },
          })
          if (active.cancelRequested || controller.signal.aborted) {
            trackTaskSnapshot(
              task,
              {
                ...latestSnapshot,
                status: 'cancelled',
                finishedAt: clockPort.now(),
                error: undefined,
              },
              projectId,
            )
            throw abortError()
          }
          if (!result) {
            const failedSnapshot: TaskStatusSnapshot = {
              ...latestSnapshot,
              status: 'failed',
              finishedAt: clockPort.now(),
              error: errorSnapshot(new Error('Task runtime returned no result'), 'no-result'),
            }
            trackTaskSnapshot(task, failedSnapshot, projectId)
            return null
          }

          assertTaskResultIdentity(task, result)
          const terminalSnapshot: TaskStatusSnapshot = {
            ...latestSnapshot,
            status: result.status,
            finishedAt: latestSnapshot.finishedAt ?? clockPort.now(),
            ...(result.error ? { error: result.error } : {}),
          }
          if (result.status === 'completed') {
            const record = recoveryRecordsRef.current.find(
              (item) => item.projectId === projectId && item.task.id === task.id,
            )
            if (record) {
              removeRecoveryRecord(task.id, projectId)
              removePersistedRecoveryRecord(record)
            }
          } else {
            trackTaskSnapshot(task, terminalSnapshot, projectId)
          }
          return result
        } catch (error: unknown) {
          const cancelled =
            active.cancelRequested || controller.signal.aborted || isAbortError(error)
          trackTaskSnapshot(
            task,
            {
              ...latestSnapshot,
              status: cancelled ? 'cancelled' : 'failed',
              finishedAt: clockPort.now(),
              error: cancelled ? undefined : errorSnapshot(error, 'desktop-task-failed'),
            },
            projectId,
          )
          throw error
        } finally {
          if (activeTasksRef.current.get(task.id) === active) activeTasksRef.current.delete(task.id)
        }
      })()
      active.promise = promise
      return promise
    },
    [
      clockPort,
      isConnected,
      removePersistedRecoveryRecord,
      removeRecoveryRecord,
      trackTaskSnapshot,
    ],
  )

  const requestGhost = useCallback(
    async (chapterId: string, text: string): Promise<string | null> => {
      if (!clientRef.current || !isConnected || !clientRef.current.runTask) return null
      try {
        const document = semanticDocumentFromText(chapterId, text)
        const task = createContinueTask({
          taskId: idGenerator.generate(`ghost-${chapterId}`),
          workspaceId: workspaceIdRef.current || '',
          workspaceRevision: activeWritingContext?.workspaceRevision ?? 1,
          document,
          selection: { from: document.text.length, to: document.text.length },
          storyState,
          metadata: { modelId: aiModel?.id },
        })
        return taskResultText(await runTrackedTask(task))
      } catch {
        return null
      }
    },
    [activeWritingContext?.workspaceRevision, aiModel?.id, isConnected, runTrackedTask, storyState],
  )

  const sendAiPrompt = useCallback(
    async (prompt: string, chapterId?: string) => {
      const trimmed = prompt.trim()
      if (!trimmed || aiBusyRef.current) return

      setAiPanelOpen(true)
      const newMessages = [...aiMessages, { role: 'user' as const, text: trimmed }]
      setAiMessages(newMessages)
      setAiInput('')

      if (!clientRef.current || !isConnected) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: '（离线沙盒模式：请先启动 `inkpi daemon` 并点击左下角重连后再使用 AI 功能）',
          },
        ])
        return
      }

      const promptRequestId = ++promptRequestRef.current
      const projectId = workspaceIdRef.current
      setAiBusy(true)
      aiBusyRef.current = true
      try {
        const client = clientRef.current
        if (!client?.runTask) throw new Error('Task runtime is unavailable')

        // P0-3: 优先从 ActiveWritingContext 提取权威的章节内容、选区与 revision (INV-06)
        let activeDocText = activeWritingContext?.chapter?.content || ''
        let activeDocRevision = activeWritingContext?.chapter?.revision ?? 1
        let targetChapterId = activeWritingContext?.chapter?.id || chapterId || 'assistant'

        if (!activeDocText && projectId && targetChapterId !== 'assistant') {
          try {
            const chs = await indexedDbProjectRepository.getAllChapters()
            const ch = chs.find((c: ChapterRecord) => c.id === targetChapterId)
            if (ch) {
              activeDocText = ch.content || ''
              activeDocRevision = ch.revision ?? 1
              targetChapterId = ch.id
            }
          } catch {
            // ignore
          }
        }

        const document =
          activeWritingContext?.chapter?.id === targetChapterId &&
          activeWritingContext?.chapter?.semanticDocument
            ? activeWritingContext.chapter.semanticDocument
            : projectContent(targetChapterId, activeDocText, activeDocRevision)

        // P1-5: 构造滚动多轮历史 turns (提取最近 6 轮历史)
        const rollingHistory = newMessages.slice(-6)

        const task = createAssistantTask({
          taskId: idGenerator.generate('assistant'),
          workspaceId: projectId || '',
          workspaceRevision: activeWritingContext?.workspaceRevision ?? 1,
          document,
          question: trimmed,
          conversationHistory: rollingHistory,
          selection: activeWritingContext?.selection
            ? { from: activeWritingContext.selection.from, to: activeWritingContext.selection.to }
            : undefined,
          storyState,
          metadata: {
            modelId: aiModel?.id,
            projectId,
            workspaceId: projectId,
            documentRevision: activeDocRevision,
          },
        })
        const result = await runTrackedTask(task)
        if (
          !mountedRef.current ||
          promptRequestRef.current !== promptRequestId ||
          workspaceIdRef.current !== projectId
        )
          return
        const text = taskResultText(result) || (result?.error?.message ?? '')
        setAiMessages((prev) => [...prev, { role: 'assistant', text }])
      } catch (err: unknown) {
        if (
          !mountedRef.current ||
          promptRequestRef.current !== promptRequestId ||
          workspaceIdRef.current !== projectId
        )
          return
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ RPC 错误：${String((err as { message?: string })?.message || err)}`,
          },
        ])
      } finally {
        if (promptRequestRef.current === promptRequestId) {
          aiBusyRef.current = false
          if (mountedRef.current) setAiBusy(false)
        }
      }
    },
    [activeWritingContext, aiMessages, aiModel?.id, isConnected, runTrackedTask, storyState],
  )

  const isCurrentRecoveryRecord = useCallback(
    (taskId: string, expectedProjectId?: string | null): boolean =>
      mountedRef.current &&
      expectedProjectId === workspaceIdRef.current &&
      recoveryRecordsRef.current.some(
        (record) => record.projectId === expectedProjectId && record.task.id === taskId,
      ),
    [],
  )

  const reconnect = useCallback(() => {
    initConnection(wsUrl)
  }, [initConnection, wsUrl])

  const runRecoveryAction = useCallback(
    (
      taskId: string,
      kind: RecoveryActionKind,
      action: () => Promise<boolean>,
    ): Promise<boolean> => {
      const existing = recoveryActionPromisesRef.current.get(taskId)
      if (existing) return existing.kind === kind ? existing.promise : Promise.resolve(false)

      let promise!: Promise<boolean>
      promise = action().finally(() => {
        if (recoveryActionPromisesRef.current.get(taskId)?.promise === promise) {
          recoveryActionPromisesRef.current.delete(taskId)
        }
      })
      recoveryActionPromisesRef.current.set(taskId, { kind, promise })
      return promise
    },
    [],
  )

  const resumeTask = useCallback(
    (taskId: string): Promise<boolean> => {
      const record = recoveryRecordsRef.current.find((item) => item.task.id === taskId)
      const client = clientRef.current
      const projectId = workspaceIdRef.current
      if (
        !record ||
        record.projectId !== projectId ||
        activeTasksRef.current.has(taskId) ||
        !client?.resumeTask ||
        !isConnected
      )
        return Promise.resolve(false)

      return runRecoveryAction(taskId, 'resume', async () => {
        try {
          await client.resumeTask!(taskId)
          if (isCurrentRecoveryRecord(taskId, projectId)) {
            trackTaskSnapshot(
              record.task,
              {
                ...record.snapshot,
                status: 'queued',
                finishedAt: undefined,
                error: undefined,
              },
              projectId,
            )
          }
          return true
        } catch (error: unknown) {
          if (isCurrentRecoveryRecord(taskId, projectId)) {
            trackTaskSnapshot(
              record.task,
              {
                ...record.snapshot,
                status: 'failed',
                finishedAt: clockPort.now(),
                error: errorSnapshot(error, 'resume-failed'),
              },
              projectId,
            )
          }
          return false
        }
      })
    },
    [clockPort, isConnected, isCurrentRecoveryRecord, runRecoveryAction, trackTaskSnapshot],
  )

  const cancelTask = useCallback(
    (taskId: string): Promise<boolean> => {
      const active = activeTasksRef.current.get(taskId)
      if (!active || active.cancelRequested) return Promise.resolve(false)
      active.cancelRequested = true
      active.controller.abort()
      trackTaskSnapshot(
        active.task,
        {
          ...active.latestSnapshot,
          status: 'cancelled',
          finishedAt: clockPort.now(),
          error: undefined,
        },
        active.projectId,
      )
      return Promise.resolve(true)
    },
    [clockPort, trackTaskSnapshot],
  )

  const dismissTask = useCallback(
    (taskId: string): Promise<boolean> => {
      if (activeTasksRef.current.has(taskId)) return Promise.resolve(false)
      const record = recoveryRecordsRef.current.find((item) => item.task.id === taskId)
      if (!record || record.projectId !== workspaceIdRef.current) return Promise.resolve(false)
      return runRecoveryAction(taskId, 'dismiss', async () => {
        if (!isCurrentRecoveryRecord(taskId, record.projectId)) return false
        removeRecoveryRecord(taskId, record.projectId)
        removePersistedRecoveryRecord(record)
        return true
      })
    },
    [
      isCurrentRecoveryRecord,
      removePersistedRecoveryRecord,
      removeRecoveryRecord,
      runRecoveryAction,
    ],
  )

  const runAiTask = runTrackedTask

  const runTrackedConvenienceTask = useCallback(
    <T>(
      task: AiTask,
      externalSignal: AbortSignal | undefined,
      run: (signal: AbortSignal, onProgress: (snapshot: TaskStatusSnapshot) => void) => Promise<T>,
      isSuccessful: (result: T) => boolean = () => true,
    ): Promise<T | null> => {
      const identityKey = serializeTaskIdentity(task)
      const existing = activeTasksRef.current.get(task.id)
      if (existing) {
        if (existing.operation !== 'convenience' || existing.identityKey !== identityKey) {
          return Promise.reject(
            new Error(`Task ${task.id} is already active with a different identity`),
          )
        }
        return existing.promise as Promise<T | null>
      }

      const client = clientRef.current
      if (!client || !isConnected) return Promise.resolve(null)

      const projectId = workspaceIdRef.current
      const controller = new AbortController()
      const linked = linkAbortSignals(controller.signal, externalSignal)
      const active: ActiveTask = {
        projectId: projectId ?? undefined,
        controller,
        task,
        client,
        operation: 'convenience',
        identityKey,
        cancelRequested: false,
        latestSnapshot: initialTaskSnapshot(task),
        promise: Promise.resolve(null),
      }
      activeTasksRef.current.set(task.id, active)

      const promise = (async (): Promise<T | null> => {
        let latestSnapshot = active.latestSnapshot
        trackTaskSnapshot(task, latestSnapshot, projectId)
        try {
          const result = await run(linked.signal, (snapshot) => {
            if (
              active.cancelRequested ||
              !mountedRef.current ||
              workspaceIdRef.current !== projectId
            )
              return
            assertTaskSnapshotIdentity(task, snapshot)
            latestSnapshot = snapshot
            active.latestSnapshot = snapshot
            trackTaskSnapshot(task, snapshot, projectId)
          })
          if (
            active.cancelRequested ||
            linked.signal.aborted ||
            !mountedRef.current ||
            workspaceIdRef.current !== projectId
          ) {
            trackTaskSnapshot(
              task,
              {
                ...latestSnapshot,
                status: 'cancelled',
                finishedAt: clockPort.now(),
                error: undefined,
              },
              projectId,
            )
            throw abortError()
          }
          if (!isSuccessful(result)) {
            trackTaskSnapshot(
              task,
              {
                ...latestSnapshot,
                status: 'failed',
                finishedAt: clockPort.now(),
                error: errorSnapshot(
                  new Error('Task completed with recoverable failures'),
                  'desktop-task-incomplete',
                ),
              },
              projectId,
            )
            return result
          }
          const record = recoveryRecordsRef.current.find(
            (item) => item.projectId === projectId && item.task.id === task.id,
          )
          if (record) {
            removeRecoveryRecord(task.id, projectId)
            removePersistedRecoveryRecord(record)
          }
          return result
        } catch (error: unknown) {
          const cancelled =
            active.cancelRequested ||
            linked.signal.aborted ||
            !mountedRef.current ||
            workspaceIdRef.current !== projectId ||
            isAbortError(error)
          trackTaskSnapshot(
            task,
            {
              ...latestSnapshot,
              status: cancelled ? 'cancelled' : 'failed',
              finishedAt: clockPort.now(),
              error: cancelled ? undefined : errorSnapshot(error, 'desktop-task-failed'),
            },
            projectId,
          )
          throw error
        } finally {
          linked.cleanup()
          if (activeTasksRef.current.get(task.id) === active) activeTasksRef.current.delete(task.id)
        }
      })()
      active.promise = promise
      return promise
    },
    [
      clockPort,
      isConnected,
      removePersistedRecoveryRecord,
      removeRecoveryRecord,
      trackTaskSnapshot,
    ],
  )

  const steerTask = useCallback(
    async (taskId: string, input: unknown) => {
      if (!clientRef.current?.steerTask || !isConnected) return false
      return clientRef.current.steerTask(taskId, input)
    },
    [isConnected],
  )

  const runContinuityAudit = useCallback(
    async (
      input: ContinuityAuditTaskInput,
      options: Parameters<NonNullable<AiAssistant['runContinuityAudit']>>[1] = {},
    ) => {
      const client = clientRef.current
      if (!client?.runContinuityAudit || !isConnected) return null
      const taskInput = { ...input, storyState: input.storyState ?? storyState }
      const task = createContinuityAuditTask(taskInput)
      return runTrackedConvenienceTask(task, options.signal, (signal, onProgress) =>
        client.runContinuityAudit!(taskInput, {
          ...options,
          signal,
          onProgress: (snapshot) => {
            onProgress(snapshot)
            options.onProgress?.(snapshot)
          },
        }),
      )
    },
    [isConnected, runTrackedConvenienceTask, storyState],
  )

  const runDeepReasoning = useCallback(
    async (
      input: DeepReasoningTaskInput,
      options: Parameters<NonNullable<AiAssistant['runDeepReasoning']>>[1] = {},
    ) => {
      const client = clientRef.current
      if (!client?.runDeepReasoning || !isConnected) return null
      const taskInput = { ...input, storyState: input.storyState ?? storyState }
      const task = createDeepReasoningTask(taskInput)
      return runTrackedConvenienceTask(task, options.signal, (signal, onProgress) =>
        client.runDeepReasoning!(taskInput, {
          ...options,
          signal,
          onProgress: (snapshot) => {
            onProgress(snapshot)
            options.onProgress?.(snapshot)
          },
        }),
      )
    },
    [isConnected, runTrackedConvenienceTask, storyState],
  )

  const runDistillationWorkflow = useCallback(
    async (input: ProjectDistillationInput, options: DistillationWorkflowOptions = {}) => {
      const client = clientRef.current
      if (!client?.runDistillationWorkflow || !isConnected) return null
      const taskInput = { ...input, storyState: input.storyState ?? storyState }
      if (taskInput.documents.length === 0) {
        return client.runDistillationWorkflow(taskInput, options)
      }
      const task = createDistillationTask({
        taskId: taskInput.taskId,
        workspaceId: workspaceIdRef.current || '',
        document: taskInput.documents[0],
        neighboringDocuments: taskInput.documents.slice(1),
        target: taskInput.target ?? 'project',
        fields: taskInput.fields,
        storyState: taskInput.storyState,
        instruction: taskInput.instruction,
        metadata: taskInput.metadata,
      })
      return runTrackedConvenienceTask(
        task,
        options.signal,
        (signal, onProgress) =>
          client.runDistillationWorkflow!(taskInput, {
            ...options,
            signal,
            onProgress: (progress) => {
              onProgress({
                taskId: task.id,
                kind: task.kind,
                status: 'running',
                progress:
                  progress.totalChunks > 0
                    ? Math.min(1, progress.completedChunks / progress.totalChunks)
                    : 0,
              })
              options.onProgress?.(progress)
            },
          }),
        (result) => result.complete,
      )
    },
    [isConnected, runTrackedConvenienceTask, storyState],
  )

  const runPluginTool = useCallback(
    async (pluginId: string, input: Record<string, unknown>) => {
      if (!clientRef.current?.runPluginTool || !isConnected) return null
      return clientRef.current.runPluginTool(pluginId, input)
    },
    [isConnected],
  )

  const runPluginWorkflow = useCallback(
    async (pluginId: string, input: unknown, metadata?: Record<string, unknown>) => {
      if (!clientRef.current?.runPluginWorkflow || !isConnected) return null
      return clientRef.current.runPluginWorkflow(pluginId, input, metadata)
    },
    [isConnected],
  )

  const syncDomain = useCallback(
    async (id: string) => {
      if (!clientRef.current?.syncDomain || !isConnected) return null
      return clientRef.current.syncDomain(id)
    },
    [isConnected],
  )

  const listArtifacts = useCallback(
    async (id: string): Promise<AiArtifact[]> => {
      if (isConnected && clientRef.current?.listArtifacts) {
        return clientRef.current.listArtifacts(id)
      }
      return new IndexedDbArtifactStore().listByWorkspace(id)
    },
    [isConnected],
  )

  return {
    isConnected,
    isReconnecting,
    aiPanelOpen,
    setAiPanelOpen,
    aiMessages,
    aiInput,
    setAiInput,
    aiBusy,
    reconnect,
    requestGhost,
    sendAiPrompt,
    runAiTask,
    taskRecovery,
    taskRecoveryLoading,
    taskRecoveryError,
    resumeTask,
    cancelTask,
    dismissTask,
    steerTask,
    runContinuityAudit,
    runDeepReasoning,
    runDistillationWorkflow,
    runPluginTool,
    runPluginWorkflow,
    syncDomain,
    listArtifacts,
    domainSyncState,
    syncConflict,
  }
}

function assertTaskSnapshotIdentity(task: AiTask, snapshot: TaskStatusSnapshot): void {
  if (snapshot?.taskId !== task.id) {
    throw new Error(
      `Task status identity mismatch: expected ${task.id}, received ${snapshot?.taskId}`,
    )
  }
  if (snapshot.kind !== task.kind) {
    throw new Error(
      `Task status kind mismatch for ${task.id}: expected ${task.kind}, received ${snapshot.kind}`,
    )
  }
}

function assertTaskResultIdentity(task: AiTask, result: TaskResult): void {
  if (result?.taskId !== task.id) {
    throw new Error(
      `Task result identity mismatch: expected ${task.id}, received ${result?.taskId}`,
    )
  }
  if (result.kind !== task.kind) {
    throw new Error(
      `Task result kind mismatch for ${task.id}: expected ${task.kind}, received ${result.kind}`,
    )
  }
  if (!isTerminalTaskStatus(result.status)) {
    throw new Error(`Task ${task.id} returned a non-terminal result status`)
  }
}

function isTerminalTaskStatus(status: unknown): boolean {
  return (
    status === 'waiting-user' ||
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled'
  )
}

function serializeTaskIdentity(task: AiTask): string {
  return stableSerialize(task)
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}

function linkAbortSignals(
  primary: AbortSignal,
  secondary?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  if (!secondary) return { signal: primary, cleanup: () => undefined }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (primary.aborted || secondary.aborted) controller.abort()
  primary.addEventListener('abort', abort)
  secondary.addEventListener('abort', abort)
  return {
    signal: controller.signal,
    cleanup: () => {
      primary.removeEventListener('abort', abort)
      secondary.removeEventListener('abort', abort)
    },
  }
}

function abortError(): Error {
  const error = new Error('Creative task was cancelled')
  error.name = 'AbortError'
  return error
}
