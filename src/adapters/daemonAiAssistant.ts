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
} from '@inkpi/protocol'
import type { AiAssistant, RpcClient } from '../ports/aiGateway'
import {
  CreativeIntelligence,
  type CreativeTaskGateway,
} from '../ai/orchestrator/creativeIntelligence'
import { listCoreInstructionDefinitions } from '../ai/instructions/coreInstructions'
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
  const creativeIntelligence = new CreativeIntelligence(taskGateway, {
    artifactStore: new DaemonArtifactStore(client),
  })
  const continuityScheduler = new ContinuityAuditScheduler(creativeIntelligence)
  const distillationWorkflow = new ProjectDistillationWorkflow(creativeIntelligence)

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
    runTask: async (task: AiTask, options = {}): Promise<TaskResult | null> => {
      await ensurePluginInstructionsRegistered()
      return attachProposalSyncRemote(
        await creativeIntelligence.run(task, options),
        proposalSyncRemote,
      )
    },

    proposalSyncRemote,

    getTaskExecution: (taskId: string) =>
      client.request<TaskExecutionSnapshot>('task.execution', { taskId }),
    getCacheStatus: () => client.request<CacheStatus>('cache.status'),
    invalidateCache: (params: CacheInvalidateParams) =>
      client.request<CacheInvalidateResult>('cache.invalidate', params),

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

    status: () => client.request<{ running: boolean }>('daemon.status'),

    close: () => client.close(),
  }
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
    if (!isRecord(result) || result.id !== expectedIds[index] || typeof result.version !== 'string') {
      throw new Error('Daemon instruction registration receipt is inconsistent')
    }
  }
}

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
