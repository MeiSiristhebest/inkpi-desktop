import type {
  AiTask,
  CacheInvalidateParams,
  CacheInvalidateResult,
  CacheStatus,
  TaskExecutionSnapshot,
  TaskResult,
  TaskStatusSnapshot,
} from '@inkpi/protocol'
import type {
  RuntimeModelRouteHealthResult,
  RuntimeModelRouteHealthState,
  RuntimeModelRouteRegistration,
  RuntimeModelRouteRemoveResult,
  RuntimeModelRouteSummary,
  RuntimeModelRoutesConfigureResult,
} from './runtimeModelRoutes'
import type { ContinuityAuditTaskInput, DeepReasoningTaskInput } from '../ai/tasks/taskFactories'
import type {
  ProjectDistillationInput,
  DistillationWorkflowOptions,
  DistillationWorkflowResult,
} from '../ai/orchestrator/verticalSlices'
import type { ContinuityFinding, DeepReasoningResult } from '../ai/results/taskResults'
import type { DomainSyncResult } from '../domain/sync/domainSyncService'
import type { ProposalSyncRemote } from '../adapters/daemonDomainSyncRemote'
import type { AiArtifact } from '../ai/artifacts'

/**
 * AI 网关端口（抽象）。
 *
 * 视图层 / 根组件不直接依赖具体的 InkRpcClient（@inkpi/client），而是依赖此端口。
 * 真实实现（InkpiDaemonGateway）封装 WebSocket JSON-RPC 的细节；测试可注入假实现。
 */

export interface RpcClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>
  close(): Promise<void>
}

export interface AiGateway {
  connect(url: string): Promise<RpcClient>
}

/**
 * 语义化 AI 助手端口。所有创作请求都通过通用 task.submit 进入 Runtime。
 */
export interface AiAssistant {
  runTask(
    task: AiTask,
    options?: {
      signal?: AbortSignal
      pollIntervalMs?: number
      onProgress?: (snapshot: TaskStatusSnapshot) => void
    },
  ): Promise<TaskResult | null>
  /** Public durable execution view, including steps, attempts and resume token. */
  getTaskExecution?(taskId: string): Promise<TaskExecutionSnapshot>
  /** Cross-process Runtime cache counters and invalidation boundary. */
  getCacheStatus?(): Promise<CacheStatus>
  invalidateCache?(params: CacheInvalidateParams): Promise<CacheInvalidateResult>
  /** Configure the Runtime-owned model route table without returning credentials. */
  configureModelRoutes?(
    routes: readonly RuntimeModelRouteRegistration[],
  ): Promise<RuntimeModelRoutesConfigureResult>
  listModelRoutes?(): Promise<RuntimeModelRouteSummary[]>
  removeModelRoute?(routeId: string): Promise<RuntimeModelRouteRemoveResult>
  getModelRouteHealth?(
    routeId: string,
    state?: RuntimeModelRouteHealthState,
  ): Promise<RuntimeModelRouteHealthResult>
  /** Optional daemon projection capability for proposal review state. */
  proposalSyncRemote?: ProposalSyncRemote
  runContinuityAudit?(
    input: ContinuityAuditTaskInput,
    options?: {
      signal?: AbortSignal
      pollIntervalMs?: number
      onProgress?: (snapshot: TaskStatusSnapshot) => void
    },
  ): Promise<ContinuityFinding[]>
  runDeepReasoning?(
    input: DeepReasoningTaskInput,
    options?: {
      signal?: AbortSignal
      pollIntervalMs?: number
      onProgress?: (snapshot: TaskStatusSnapshot) => void
    },
  ): Promise<DeepReasoningResult>
  runDistillationWorkflow?(
    input: ProjectDistillationInput,
    options?: DistillationWorkflowOptions,
  ): Promise<DistillationWorkflowResult>
  /** Execute a Runtime-owned first-party Extension Tool across the Daemon boundary. */
  runPluginTool?(pluginId: string, input: Record<string, unknown>): Promise<unknown | null>
  /** Execute a Runtime-owned first-party Workflow task across the Daemon boundary. */
  runPluginWorkflow?(
    pluginId: string,
    input: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<unknown | null>
  steerTask?(taskId: string, input: unknown): Promise<boolean>
  resumeTask?(taskId: string): Promise<void>
  syncDomain?(workspaceId: string): Promise<DomainSyncResult>
  /** Read workspace artifacts from the connected Runtime authority. */
  listArtifacts?(workspaceId: string): Promise<AiArtifact[]>
  /** Permanently purge a workspace from the Runtime projection. */
  purgeWorkspace?(workspaceId: string): Promise<unknown>
  /** daemon 存活状态 */
  status(): Promise<{ running: boolean }>
  close(): Promise<void>
}
