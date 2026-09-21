import type {
  AiTask,
  CacheInvalidateParams,
  CacheInvalidateResult,
  CacheStatus,
  TaskCancelResult,
  TaskExecutionSnapshot,
  TaskResult,
  TaskStatusSnapshot,
  TaskSubmitResult,
  ToolResultMessage,
} from '@inkpi/protocol'
import type {
  RuntimeModelRouteHealthResult,
  RuntimeModelRouteHealthState,
  RuntimeModelRouteRegistration,
  RuntimeModelRouteRemoveResult,
  RuntimeModelRouteSummary,
  RuntimeModelRoutesConfigureResult,
} from '../ports/runtimeModelRoutes'
import type { AiAssistant, RpcClient } from '../ports/aiGateway'
import {
  CreativeIntelligence,
  type CreativeTaskGateway,
} from '../ai/orchestrator/creativeIntelligence'
import { listCoreInstructionDefinitions } from '../ai/instructions/coreInstructions'
import { getRuntimeModelPreference, getRuntimeModelRoutes } from '../core/runtimeModelPreference'
import {
  listPluginInstructionDefinitions,
  type DesktopInstructionDefinition,
} from '../ai/instructions/pluginInstructions'
import {
  ContinuityAuditScheduler,
  ProjectDistillationWorkflow,
} from '../ai/orchestrator/verticalSlices'
import {
  createDaemonDomainSyncRemote,
  createDaemonProposalSyncRemote,
} from './daemonDomainSyncRemote'
import { DomainSyncService } from '../domain/sync/domainSyncService'
import { IndexedDbDomainChangeStore } from './indexedDbDomainChangeStore'
import { attachProposalSyncRemote } from '../ai/proposals/remoteProposalStore'
import { DaemonArtifactStore } from './daemonArtifactStore'
import { getPluginRuntimeEntry } from '../ai/tasks/pluginRuntimeCatalog'

let runtimePluginTaskSequence = 0
let runtimePluginToolSequence = 0

/**
 * 把底层 RpcClient（字符串方法 JSON-RPC）封装成语义化 AiAssistant。
 * 传输层方法名集中在此处，视图层 / 根组件不再出现 'session.create' 等字符串（§14.4）。
 */
export const createDaemonAiAssistant = (client: RpcClient): AiAssistant => {
  const proposalSyncRemote = createDaemonProposalSyncRemote(client)
  let pluginInstructionsReady: Promise<void> | undefined
  const taskGateway: CreativeTaskGateway = {
    submitTask: (task) => client.request<TaskSubmitResult>('task.submit', { task }),
    getTaskStatus: (taskId) => client.request<TaskStatusSnapshot>('task.status', { taskId }),
    getTaskExecution: (taskId) =>
      client.request<TaskExecutionSnapshot>('task.execution', { taskId }),
    cancelTask: (taskId) => client.request<TaskCancelResult>('task.cancel', { taskId }),
    steerTask: (taskId, input) =>
      client.request<{ accepted: boolean }>('task.steer', { taskId, input }),
    resumeTask: (taskId) => client.request<TaskSubmitResult>('task.resume', { taskId }),
  }
  const artifactStore = new DaemonArtifactStore(client)
  const creativeIntelligence = new CreativeIntelligence(taskGateway, {
    artifactStore,
  })
  const continuityScheduler = new ContinuityAuditScheduler(creativeIntelligence)
  const distillationWorkflow = new ProjectDistillationWorkflow(creativeIntelligence)
  let configuredRoutesFingerprint: string | undefined
  let configuredRoutes = false
  let routeConfiguration: Promise<void> | undefined

  const sendModelRoutes = async (
    routes: readonly RuntimeModelRouteRegistration[],
  ): Promise<RuntimeModelRoutesConfigureResult> => {
    const result = await client.request<RuntimeModelRoutesConfigureResult>(
      'model.routes.configure',
      { routes },
    )
    configuredRoutesFingerprint = JSON.stringify(routes)
    configuredRoutes = true
    return result
  }

  const syncRuntimeModelRoutes = async (): Promise<void> => {
    const routes = [...getRuntimeModelRoutes()]
    const fingerprint = JSON.stringify(routes)
    if (!routes.length && !configuredRoutes) return
    if (fingerprint === configuredRoutesFingerprint) return
    if (routeConfiguration) {
      await routeConfiguration
      return syncRuntimeModelRoutes()
    }
    routeConfiguration = sendModelRoutes(routes)
      .then(() => undefined)
      .finally(() => {
        routeConfiguration = undefined
      })
    await routeConfiguration
  }

  const runTask = async (task: AiTask, options = {}): Promise<TaskResult | null> => {
    await syncRuntimeModelRoutes()
    await ensurePluginInstructionsRegistered()
    // 把用户选定的模型附加到 metadata.modelRoute，让 Runtime 路由精确命中该模型。
    // 仅当任务未显式携带偏好时注入，保留 pluginId/runtimeTarget 等既有 metadata。
    const preference = getRuntimeModelPreference()
    if (preference && !task.metadata?.modelRoute) {
      task = { ...task, metadata: { ...task.metadata, modelRoute: preference } }
    }
    return attachProposalSyncRemote(
      await creativeIntelligence.run(task, options),
      proposalSyncRemote,
    )
  }

  const ensurePluginInstructionsRegistered = (): Promise<void> => {
    if (!pluginInstructionsReady) {
      pluginInstructionsReady = (async () => {
        const instructions = [
          ...listCoreInstructionDefinitions(),
          ...listPluginInstructionDefinitions(),
        ]
        const result = await client.request<unknown>('instruction.register', { instructions })
        assertInstructionRegistration(result, instructions)
      })().catch((error) => {
        // A failed first handshake must be retryable, while concurrent callers
        // still share the same in-flight registration promise.
        pluginInstructionsReady = undefined
        throw error
      })
    }
    return pluginInstructionsReady
  }

  return {
    runTask,

    runPluginTool: async (
      pluginId: string,
      input: Record<string, unknown>,
    ): Promise<unknown | null> => {
      const entry = getPluginRuntimeEntry(pluginId)
      if (!entry?.toolName) return null
      const result = await client.request<ToolResultMessage>('tool.execute', {
        toolName: entry.toolName,
        toolCallId: `desktop-plugin-tool-${pluginId}-${++runtimePluginToolSequence}`,
        arguments: input,
      })
      if (result.isError) {
        throw new Error(result.content.map((item) => ('text' in item ? item.text : '')).join(' '))
      }
      return result.details === undefined
        ? parseToolResultContent(result)
        : normalizePluginToolOutput(result.details)
    },

    runPluginWorkflow: async (
      pluginId: string,
      input: unknown,
      metadata?: Record<string, unknown>,
    ): Promise<unknown | null> => {
      const entry = getPluginRuntimeEntry(pluginId)
      if (entry?.runtimeClass !== 'workflow' || !entry.taskKind) return null
      const result = await runTask({
        id: `plugin-workflow-${pluginId}-${Date.now()}-${++runtimePluginTaskSequence}`,
        kind: entry.taskKind,
        input: { payload: input },
        contextPolicy: {
          includeSelection: false,
          includeProjectState: false,
          metadata: { pluginId, runtimeTarget: entry.runtimeTarget },
        },
        executionPolicy: { strategy: 'workflow', mode: 'foreground', cancellable: true },
        outputContract: { format: 'structured', persistence: 'ephemeral' },
        effectPolicy: { mode: 'read-only' },
        requirements: {
          outputFormats: ['structured'],
          needsStructuredOutput: true,
        },
        metadata: { pluginId, runtimeTarget: entry.runtimeTarget, ...metadata },
      })
      if (result?.status !== 'completed' || result.output?.format !== 'structured') return null
      return result.output.data
    },

    proposalSyncRemote,

    getTaskExecution: (taskId: string) =>
      client.request<TaskExecutionSnapshot>('task.execution', { taskId }),
    getCacheStatus: () => client.request<CacheStatus>('cache.status'),
    invalidateCache: (params: CacheInvalidateParams) =>
      client.request<CacheInvalidateResult>('cache.invalidate', params),
    configureModelRoutes: (routes: readonly RuntimeModelRouteRegistration[]) =>
      sendModelRoutes(routes),
    listModelRoutes: () => client.request<RuntimeModelRouteSummary[]>('model.routes.list'),
    removeModelRoute: (routeId: string) =>
      client.request<RuntimeModelRouteRemoveResult>('model.routes.remove', { routeId }),
    getModelRouteHealth: (routeId: string, state?: RuntimeModelRouteHealthState) =>
      client.request<RuntimeModelRouteHealthResult>('model.routes.health', {
        routeId,
        ...(state ? { state } : {}),
      }),

    runContinuityAudit: async (input, options = {}) => {
      await ensurePluginInstructionsRegistered()
      return continuityScheduler.schedule(input, options)
    },

    runDeepReasoning: async (input, options = {}) => {
      await ensurePluginInstructionsRegistered()
      return creativeIntelligence.runDeepReasoning(input, options)
    },

    runDistillationWorkflow: async (input, options = {}) => {
      await ensurePluginInstructionsRegistered()
      return distillationWorkflow.run(input, options)
    },

    steerTask: async (taskId: string, input: unknown): Promise<boolean> => {
      const result = await client.request<{ accepted: boolean }>('task.steer', { taskId, input })
      return result.accepted
    },

    resumeTask: async (taskId: string): Promise<void> => {
      await client.request('task.resume', { taskId })
    },

    syncDomain: (workspaceId: string) =>
      new DomainSyncService(
        new IndexedDbDomainChangeStore(),
        createDaemonDomainSyncRemote(client),
      ).sync(workspaceId),

    listArtifacts: (workspaceId: string) => artifactStore.listByWorkspace(workspaceId),

    purgeWorkspace: (workspaceId: string) =>
      client.request<{ purged: boolean; workspaceId: string }>('workspace.purge', {
        workspaceId,
      }),

    status: () => client.request<{ running: boolean }>('daemon.status'),

    close: () => client.close(),
  }
}

type PluginToolOutput =
  null | boolean | number | string | PluginToolOutput[] | { [key: string]: PluginToolOutput }

function parseToolResultContent(result: ToolResultMessage): PluginToolOutput {
  const text = result.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map((item) => item.text)
    .join('')
  if (!text) return null
  try {
    return normalizePluginToolOutput(JSON.parse(text))
  } catch {
    return text
  }
}

function normalizePluginToolOutput(value: unknown): PluginToolOutput {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (Array.isArray(value)) return value.map(normalizePluginToolOutput)
  if (isRecord(value)) {
    const output: { [key: string]: PluginToolOutput } = {}
    for (const [key, child] of Object.entries(value)) {
      output[key] = normalizePluginToolOutput(child)
    }
    return output
  }
  return String(value)
}

/**
 * Validate the versioned registration receipt returned by the current Daemon.
 * Older compatible daemons only returned `{ success: true }`, so the richer
 * fields are enforced whenever they are present without breaking that boundary.
 */
function assertInstructionRegistration(
  value: unknown,
  definitions: readonly DesktopInstructionDefinition[],
): void {
  if (!isRecord(value) || value.success !== true) {
    throw new Error('Daemon instruction registration did not succeed')
  }

  const hasVersionedReceipt =
    'registered' in value || 'count' in value || 'instructionIds' in value || 'results' in value
  if (!hasVersionedReceipt) return

  if (value.registered !== true) throw new Error('Daemon did not confirm instruction registration')
  if (value.count !== definitions.length) {
    throw new Error(
      `Daemon registered ${String(value.count)} instructions; expected ${definitions.length}`,
    )
  }
  const expectedIds = definitions.map((definition) => definition.id)
  if (!sameStringArray(value.instructionIds, expectedIds)) {
    throw new Error('Daemon instruction registration IDs do not match the Desktop catalog')
  }
  if (typeof value.version !== 'string' || !value.version.trim()) {
    throw new Error('Daemon instruction registration version is unavailable')
  }
  if (!Array.isArray(value.results) || value.results.length !== definitions.length) {
    throw new Error('Daemon instruction registration receipt is incomplete')
  }
  for (let index = 0; index < value.results.length; index += 1) {
    const result = value.results[index]
    if (
      !isRecord(result) ||
      result.id !== expectedIds[index] ||
      typeof result.version !== 'string'
    ) {
      throw new Error('Daemon instruction registration receipt is inconsistent')
    }
  }
}

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
