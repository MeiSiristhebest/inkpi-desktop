import type {
  AiTask,
  TaskCancelResult,
  TaskResult,
  TaskStatusSnapshot,
  TaskSubmitResult,
} from '@inkpi/protocol'
import {
  createContinueTask,
  createContinuityAuditTask,
  createDeepReasoningTask,
  createDistillationTask,
  createRewriteTask,
  type ContinueTaskInput,
  type ContinuityAuditTaskInput,
  type DeepReasoningTaskInput,
  type DistillationTaskInput,
  type RewriteTaskInput,
} from '../tasks/taskFactories'
import {
  parseContinuityFindings,
  parseDeepReasoning,
  parseDistilledFacts,
  requirePatchResult,
  requireTextResult,
  type ContinuityFinding,
  type DeepReasoningResult,
  type DistilledStoryFacts,
} from '../results/taskResults'

export interface CreativeTaskGateway {
  submitTask(task: AiTask): Promise<TaskSubmitResult>
  getTaskStatus(taskId: string): Promise<TaskStatusSnapshot>
  cancelTask(taskId: string): Promise<TaskCancelResult>
  steerTask?(taskId: string, input: unknown): Promise<{ accepted: boolean }>
  resumeTask?(taskId: string): Promise<TaskSubmitResult>
}

export interface RunTaskOptions {
  signal?: AbortSignal
  pollIntervalMs?: number
  onProgress?: (snapshot: TaskStatusSnapshot) => void
}

export class CreativeIntelligence {
  private readonly gateway: CreativeTaskGateway

  constructor(gateway: CreativeTaskGateway) {
    this.gateway = gateway
  }

  async run(task: AiTask, options: RunTaskOptions = {}): Promise<TaskResult> {
    await this.gateway.submitTask(task)
    const pollIntervalMs = options.pollIntervalMs ?? 100
    while (true) {
      if (options.signal?.aborted) {
        await this.gateway.cancelTask(task.id)
        throw abortError()
      }
      const snapshot = await this.gateway.getTaskStatus(task.id)
      options.onProgress?.(snapshot)
      if (isTerminal(snapshot.status)) {
        if (!snapshot.result) throw new Error(`Task ${task.id} ended without a result`)
        return snapshot.result
      }
      await delay(pollIntervalMs, options.signal)
    }
  }

  async runContinue(input: ContinueTaskInput, options: RunTaskOptions = {}): Promise<string> {
    return requireTextResult(await this.run(createContinueTask(input), options))
  }

  async runRewrite(input: RewriteTaskInput, options: RunTaskOptions = {}): Promise<unknown> {
    return requirePatchResult(await this.run(createRewriteTask(input), options))
  }

  async runContinuityAudit(
    input: ContinuityAuditTaskInput,
    options: RunTaskOptions = {},
  ): Promise<ContinuityFinding[]> {
    return parseContinuityFindings(await this.run(createContinuityAuditTask(input), options))
  }

  async runDeepReasoning(
    input: DeepReasoningTaskInput,
    options: RunTaskOptions = {},
  ): Promise<DeepReasoningResult> {
    return parseDeepReasoning(await this.run(createDeepReasoningTask(input), options))
  }

  async runDistillation(
    input: DistillationTaskInput,
    options: RunTaskOptions = {},
  ): Promise<DistilledStoryFacts> {
    return parseDistilledFacts(await this.run(createDistillationTask(input), options))
  }

  async steer(taskId: string, input: unknown): Promise<boolean> {
    if (!this.gateway.steerTask) return false
    return (await this.gateway.steerTask(taskId, input)).accepted
  }

  async resume(taskId: string): Promise<TaskSubmitResult> {
    if (!this.gateway.resumeTask) throw new Error('Task gateway does not support resume')
    return this.gateway.resumeTask(taskId)
  }

  status(taskId: string): Promise<TaskStatusSnapshot> {
    return this.gateway.getTaskStatus(taskId)
  }
}

function isTerminal(status: TaskStatusSnapshot['status']): boolean {
  return status === 'waiting-user' || status === 'completed' || status === 'failed' || status === 'cancelled'
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(abortError())
      },
      { once: true },
    )
  })
}

function abortError(): Error {
  const error = new Error('Creative task was cancelled')
  error.name = 'AbortError'
  return error
}
