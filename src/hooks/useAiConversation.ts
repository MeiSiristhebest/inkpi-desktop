import { useState, useEffect, useRef, useCallback } from 'react'
import { connectToDaemon } from '../core/daemonConnection'
import { inkpiDaemonGateway } from '../adapters/inkpiDaemonGateway'
import type { AiAssistant } from '../ports/aiGateway'
import type { Clock } from '../ports/clock'
import { clock } from '../adapters/clock'
import type { ModelConfig } from '../core/settings'
import { DEFAULT_DAEMON_URL } from '../config'
import type { AiTask, TaskResult, TaskStatus, TaskStatusSnapshot } from '@inkpi/protocol'
import { semanticDocumentFromText } from '../domain/content'
import type { StoryState } from '../domain/story'
import { createAssistantTask, createContinueTask } from '../ai/tasks/taskFactories'
import { taskResultText } from '../ai/tasks/pluginTasks'
import { idGenerator } from '../adapters/idGenerator'
import type { DomainSyncResult } from '../domain/sync/domainSyncService'
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
  syncDomain: (workspaceId: string) => Promise<DomainSyncResult | null>
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
): AiConversation {
  const { initialPanelOpen = false, storyState } = options
  const taskStore = options.taskRecoveryStore ?? indexedDbTaskRecoveryStore
  const clockPort = options.clock ?? clock
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [connectionEpoch, setConnectionEpoch] = useState(0)
  const clientRef = useRef<AiAssistant | null>(null)
  const mountedRef = useRef(false)
  const workspaceIdRef = useRef(workspaceId)
  const activeTasksRef = useRef(new Map<string, { projectId?: string; controller: AbortController; task: AiTask }>())
  const recoveryRecordsRef = useRef<TaskRecoveryRecord[]>([])

  const [aiPanelOpen, setAiPanelOpen] = useState(initialPanelOpen)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [taskRecovery, setTaskRecovery] = useState<TaskRecoveryRecord[]>([])
  const [taskRecoveryLoading, setTaskRecoveryLoading] = useState(Boolean(workspaceId))
  const [taskRecoveryError, setTaskRecoveryError] = useState<string>()

  const replaceRecoveryRecords = useCallback((records: TaskRecoveryRecord[]) => {
    const sorted = [...records].sort((left, right) => right.updatedAt - left.updatedAt)
    recoveryRecordsRef.current = sorted
    setTaskRecovery(sorted)
  }, [])

  const upsertRecoveryRecord = useCallback(
    (record: TaskRecoveryRecord) => {
      if (record.projectId !== workspaceIdRef.current) return
      const records = recoveryRecordsRef.current.filter((item) => item.task.id !== record.task.id)
      replaceRecoveryRecords([...records, record])
    },
    [replaceRecoveryRecords],
  )

  const removeRecoveryRecord = useCallback(
    (taskId: string) => {
      replaceRecoveryRecords(
        recoveryRecordsRef.current.filter((record) => record.task.id !== taskId),
      )
    },
    [replaceRecoveryRecords],
  )

  const persistRecoveryRecord = useCallback(
    (record: TaskRecoveryRecord) => {
      void taskStore.save(record).catch((error: unknown) => {
        if (mountedRef.current && record.projectId === workspaceIdRef.current) {
          setTaskRecoveryError(error instanceof Error ? error.message : String(error))
        }
      })
    },
    [taskStore],
  )

  const removePersistedRecoveryRecord = useCallback(
    (record: TaskRecoveryRecord) => {
      void taskStore.remove(record.projectId, record.task.id).catch((error: unknown) => {
        if (mountedRef.current && record.projectId === workspaceIdRef.current) {
          setTaskRecoveryError(error instanceof Error ? error.message : String(error))
        }
      })
    },
    [taskStore],
  )

  const trackTaskSnapshot = useCallback(
    (task: AiTask, snapshot: TaskStatusSnapshot) => {
      const projectId = workspaceIdRef.current
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
    setIsReconnecting(true)
    const result = await connectToDaemon(inkpiDaemonGateway, url, {
      isTauri: isTauriContext(),
      shouldAbort: () => !mountedRef.current,
    })
    if (!mountedRef.current) {
      result.client?.close().catch(() => {})
      return
    }
    const previousClient = clientRef.current
    clientRef.current = result.client
    if (previousClient && previousClient !== result.client) {
      void previousClient.close().catch(() => {})
    }
    setIsConnected(result.connected)
    setIsReconnecting(false)
    if (result.connected) setConnectionEpoch((epoch) => epoch + 1)
    if (!result.connected) {
      console.warn('[InkPi Desktop] Daemon 连接失败，进入离线沙盒模式')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    initConnection(wsUrl)
    return () => {
      mountedRef.current = false
      if (clientRef.current) clientRef.current.close().catch(() => {})
    }
    // 仅在挂载时连接；wsUrl 变化由 reconnect 显式触发（与原 App 行为一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    workspaceIdRef.current = workspaceId
    recoveryRecordsRef.current = []
    setTaskRecovery([])
    setTaskRecoveryError(undefined)
    if (!workspaceId) {
      setTaskRecoveryLoading(false)
      return
    }

    let alive = true
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
        if (!alive) return
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
  }, [
    clockPort,
    connectionEpoch,
    isConnected,
    replaceRecoveryRecords,
    taskStore,
    workspaceId,
  ])

  useEffect(() => {
    if (!workspaceId || !isConnected || !clientRef.current?.syncDomain) return
    void clientRef.current.syncDomain(workspaceId).catch((error) => {
      console.warn('[InkPi Desktop] Domain projection sync failed:', error)
    })
  }, [isConnected, workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let syncQueue: Promise<unknown> = Promise.resolve()
    const scheduleSync = () => {
      if (!isConnected || !clientRef.current?.syncDomain) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        syncQueue = syncQueue
          .catch(() => undefined)
          .then(() => clientRef.current?.syncDomain?.(workspaceId))
          .catch((error: unknown) => {
            console.warn('[InkPi Desktop] Local domain change sync failed:', error)
          })
      }, 100)
    }
    const unsubscribe = domainChangeEvents.subscribe(workspaceId, scheduleSync)
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [isConnected, workspaceId])

  const runTrackedTask = useCallback(
    async (task: AiTask): Promise<TaskResult | null> => {
      const client = clientRef.current
      if (!client || !isConnected || !client.runTask) return null

      const controller = new AbortController()
      const projectId = workspaceIdRef.current
      activeTasksRef.current.set(task.id, { projectId: projectId ?? undefined, controller, task })
      let latestSnapshot = initialTaskSnapshot(task)
      trackTaskSnapshot(task, latestSnapshot)

      try {
        const result = await client.runTask(task, {
          signal: controller.signal,
          onProgress: (snapshot) => {
            latestSnapshot = snapshot
            trackTaskSnapshot(task, snapshot)
          },
        })
        if (!result) {
          const failedSnapshot: TaskStatusSnapshot = {
            ...latestSnapshot,
            status: 'failed',
            finishedAt: clockPort.now(),
            error: errorSnapshot(new Error('Task runtime returned no result'), 'no-result'),
          }
          trackTaskSnapshot(task, failedSnapshot)
          return null
        }

        const terminalSnapshot: TaskStatusSnapshot = {
          ...latestSnapshot,
          status: result.status,
          finishedAt: latestSnapshot.finishedAt ?? clockPort.now(),
          ...(result.error ? { error: result.error } : {}),
        }
        if (result.status === 'completed') {
          const record = recoveryRecordsRef.current.find((item) => item.task.id === task.id)
          if (record) {
            removeRecoveryRecord(task.id)
            removePersistedRecoveryRecord(record)
          }
        } else {
          trackTaskSnapshot(task, terminalSnapshot)
        }
        return result
      } catch (error: unknown) {
        const cancelled = controller.signal.aborted || isAbortError(error)
        trackTaskSnapshot(task, {
          ...latestSnapshot,
          status: cancelled ? 'cancelled' : 'failed',
          finishedAt: clockPort.now(),
          error: cancelled ? undefined : errorSnapshot(error, 'desktop-task-failed'),
        })
        throw error
      } finally {
        activeTasksRef.current.delete(task.id)
      }
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
    [aiModel?.id, isConnected, runTrackedTask, storyState],
  )

  const sendAiPrompt = useCallback(
    async (prompt: string, chapterId?: string) => {
      const trimmed = prompt.trim()
      if (!trimmed || aiBusy) return

      setAiPanelOpen(true)
      setAiMessages((prev) => [...prev, { role: 'user', text: trimmed }])
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

      setAiBusy(true)
      try {
        if (!clientRef.current.runTask) throw new Error('Task runtime is unavailable')
        const document = semanticDocumentFromText(chapterId || 'assistant', '')
        const task = createAssistantTask({
          taskId: idGenerator.generate('assistant'),
          document,
          question: trimmed,
          storyState,
          metadata: { modelId: aiModel?.id },
        })
        const result = await runTrackedTask(task)
        const text = taskResultText(result) || (result?.error?.message ?? '')
        setAiMessages((prev) => [...prev, { role: 'assistant', text }])
      } catch (err: unknown) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ RPC 错误：${String((err as { message?: string })?.message || err)}`,
          },
        ])
      } finally {
        setAiBusy(false)
      }
    },
    [aiBusy, aiModel?.id, isConnected, runTrackedTask, storyState],
  )

  const reconnect = useCallback(() => {
    initConnection(wsUrl)
  }, [initConnection, wsUrl])

  const resumeTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const record = recoveryRecordsRef.current.find((item) => item.task.id === taskId)
      if (!record || !clientRef.current?.resumeTask || !isConnected) return false
      try {
        await clientRef.current.resumeTask(taskId)
        trackTaskSnapshot(record.task, {
          ...record.snapshot,
          status: 'queued',
          finishedAt: undefined,
          error: undefined,
        })
        return true
      } catch (error: unknown) {
        trackTaskSnapshot(record.task, {
          ...record.snapshot,
          status: 'failed',
          finishedAt: clockPort.now(),
          error: errorSnapshot(error, 'resume-failed'),
        })
        return false
      }
    },
    [clockPort, isConnected, trackTaskSnapshot],
  )

  const cancelTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const active = activeTasksRef.current.get(taskId)
      if (!active) return false
      active.controller.abort()
      trackTaskSnapshot(active.task, {
        taskId,
        kind: active.task.kind,
        status: 'cancelled',
        finishedAt: clockPort.now(),
      })
      return true
    },
    [clockPort, trackTaskSnapshot],
  )

  const dismissTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (activeTasksRef.current.has(taskId)) return false
      const record = recoveryRecordsRef.current.find((item) => item.task.id === taskId)
      if (!record) return false
      removeRecoveryRecord(taskId)
      removePersistedRecoveryRecord(record)
      return true
    },
    [removePersistedRecoveryRecord, removeRecoveryRecord],
  )

  const runAiTask = runTrackedTask

  const steerTask = useCallback(
    async (taskId: string, input: unknown) => {
      if (!clientRef.current?.steerTask || !isConnected) return false
      return clientRef.current.steerTask(taskId, input)
    },
    [isConnected],
  )

  const runContinuityAudit = useCallback(
    async (input: ContinuityAuditTaskInput, options = {}) => {
      if (!clientRef.current?.runContinuityAudit || !isConnected) return null
      return clientRef.current.runContinuityAudit(
        { ...input, storyState: input.storyState ?? storyState },
        options,
      )
    },
    [isConnected, storyState],
  )

  const runDeepReasoning = useCallback(
    async (input: DeepReasoningTaskInput, options = {}) => {
      if (!clientRef.current?.runDeepReasoning || !isConnected) return null
      return clientRef.current.runDeepReasoning(
        { ...input, storyState: input.storyState ?? storyState },
        options,
      )
    },
    [isConnected, storyState],
  )

  const runDistillationWorkflow = useCallback(
    async (input: ProjectDistillationInput, options: DistillationWorkflowOptions = {}) => {
      if (!clientRef.current?.runDistillationWorkflow || !isConnected) return null
      return clientRef.current.runDistillationWorkflow(
        { ...input, storyState: input.storyState ?? storyState },
        options,
      )
    },
    [isConnected, storyState],
  )

  const syncDomain = useCallback(
    async (id: string) => {
      if (!clientRef.current?.syncDomain || !isConnected) return null
      return clientRef.current.syncDomain(id)
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
    syncDomain,
  }
}
