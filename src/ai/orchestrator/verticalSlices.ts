import type { SemanticDocument } from '../../domain/content'
import type { StoryState } from '../../domain/story'
import { CreativeIntelligence, type RunTaskOptions } from './creativeIntelligence'
import type { ContinuityAuditTaskInput, DistillationTaskInput } from '../tasks/taskFactories'
import type { ContinuityFinding, DistilledStoryFacts } from '../results/taskResults'

export interface ContinuityAuditSchedulerOptions {
  debounceMs?: number
}

interface PendingAudit {
  key: string
  documentId: string
  input: ContinuityAuditTaskInput
  options: RunTaskOptions
  controller: AbortController
  timer: ReturnType<typeof setTimeout>
  subscriber: AuditSubscriber
  subscribers: AuditSubscriber[]
  abortListener?: () => void
}

interface AuditSubscriber {
  resolve: (value: ContinuityFinding[]) => void
  reject: (error: unknown) => void
  signal?: AbortSignal
  abortListener?: () => void
}

/** Debounced, cancellable and deduplicated VS3 continuity-audit runner. */
export class ContinuityAuditScheduler {
  private readonly intelligence: CreativeIntelligence
  private readonly debounceMs: number
  private readonly pending = new Map<string, PendingAudit>()

  constructor(intelligence: CreativeIntelligence, options: ContinuityAuditSchedulerOptions = {}) {
    this.intelligence = intelligence
    this.debounceMs = Math.max(0, options.debounceMs ?? 300)
  }

  schedule(
    input: ContinuityAuditTaskInput,
    options: RunTaskOptions = {},
  ): Promise<ContinuityFinding[]> {
    const key = `${input.document.documentId}:${input.document.revision}:${input.scope ?? 'document'}`
    const existing = this.pending.get(key)
    if (existing) return this.subscribe(existing, options.signal)

    for (const entry of this.pending.values()) {
      if (entry.documentId !== input.document.documentId) continue
      this.cancelEntry(entry, new AbortError('A newer document revision superseded this audit'))
    }

    let resolve!: (value: ContinuityFinding[]) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<ContinuityFinding[]>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    const subscriber: AuditSubscriber = { resolve, reject, signal: options.signal }
    const entry = {
      key,
      documentId: input.document.documentId,
      input,
      options,
      controller: new AbortController(),
      // SAFETY: timer is assigned immediately after object creation via setTimeout;
      // the intermediate undefined satisfies the PendingAudit interface.
      timer: undefined as unknown as ReturnType<typeof setTimeout>,
      subscriber,
      subscribers: [subscriber],
    }
    entry.timer = setTimeout(() => {
      void this.execute(entry)
    }, this.debounceMs)
    this.pending.set(key, entry)
    this.bindOwnerCancellation(entry)
    return promise
  }

  cancel(documentId?: string): boolean {
    let cancelled = false
    for (const entry of [...this.pending.values()]) {
      if (documentId && entry.documentId !== documentId) continue
      cancelled = true
      this.cancelEntry(entry, new AbortError())
    }
    return cancelled
  }

  pendingCount(): number {
    return this.pending.size
  }

  private async execute(entry: PendingAudit): Promise<void> {
    if (this.pending.get(entry.key) !== entry) return
    clearTimeout(entry.timer)
    const { signal, cleanup } = linkedSignal(entry.controller.signal, entry.options.signal)
    try {
      const findings = await this.intelligence.runContinuityAudit(entry.input, {
        ...entry.options,
        signal,
      })
      this.resolveEntry(entry, findings)
    } catch (error) {
      this.rejectEntry(entry, error)
    } finally {
      cleanup()
      if (entry.abortListener && entry.options.signal) {
        entry.options.signal.removeEventListener('abort', entry.abortListener)
        entry.abortListener = undefined
      }
      if (this.pending.get(entry.key) === entry) this.pending.delete(entry.key)
    }
  }

  private cancelEntry(entry: PendingAudit, error: Error): void {
    if (this.pending.get(entry.key) !== entry) return
    clearTimeout(entry.timer)
    if (entry.abortListener && entry.options.signal) {
      entry.options.signal.removeEventListener('abort', entry.abortListener)
      entry.abortListener = undefined
    }
    entry.controller.abort()
    this.rejectEntry(entry, error)
    if (this.pending.get(entry.key) === entry) this.pending.delete(entry.key)
  }

  private resolveEntry(entry: PendingAudit, value: ContinuityFinding[]): void {
    for (const subscriber of entry.subscribers) {
      this.cleanupSubscriber(subscriber)
      subscriber.resolve(value)
    }
  }

  private rejectEntry(entry: PendingAudit, error: unknown): void {
    for (const subscriber of entry.subscribers) {
      this.cleanupSubscriber(subscriber)
      subscriber.reject(error)
    }
  }

  private subscribe(entry: PendingAudit, signal?: AbortSignal): Promise<ContinuityFinding[]> {
    return new Promise((resolve, reject) => {
      const subscriber: AuditSubscriber = { resolve, reject, signal }
      if (signal?.aborted) {
        reject(new AbortError())
        return
      }
      if (signal) {
        const onAbort = () => {
          this.removeSubscriber(entry, subscriber)
          this.cleanupSubscriber(subscriber)
          reject(new AbortError())
        }
        subscriber.abortListener = onAbort
        signal.addEventListener('abort', onAbort, { once: true })
      }
      entry.subscribers.push(subscriber)
    })
  }

  private bindOwnerCancellation(entry: PendingAudit): void {
    const signal = entry.options.signal
    if (!signal) return
    if (signal.aborted) {
      this.cancelEntry(entry, new AbortError())
      return
    }
    const onAbort = () => this.cancelEntry(entry, new AbortError())
    entry.abortListener = onAbort
    signal.addEventListener('abort', onAbort, { once: true })
  }

  private removeSubscriber(entry: PendingAudit, subscriber: AuditSubscriber): void {
    const index = entry.subscribers.indexOf(subscriber)
    if (index >= 0) entry.subscribers.splice(index, 1)
  }

  private cleanupSubscriber(subscriber: AuditSubscriber): void {
    if (subscriber.abortListener && subscriber.signal) {
      subscriber.signal.removeEventListener('abort', subscriber.abortListener)
      subscriber.abortListener = undefined
    }
  }
}

export interface DistillationCheckpoint {
  nextChunk: number
  completedChunkIndexes: number[]
  failedChunkIndexes: number[]
  failedChunks: string[]
  facts: DistilledStoryFacts
}

export interface ProjectDistillationInput {
  taskId: string
  workspaceId: string
  documents: SemanticDocument[]
  target?: DistillationTaskInput['target']
  fields?: string[]
  storyState?: StoryState
  instruction?: string
  metadata?: Record<string, unknown>
}

export interface DistillationWorkflowOptions extends Omit<RunTaskOptions, 'onProgress'> {
  chunkSize?: number
  checkpoint?: DistillationCheckpoint
  saveCheckpoint?: (checkpoint: DistillationCheckpoint) => void | Promise<void>
  continueOnError?: boolean
  onProgress?: (progress: {
    completedChunks: number
    totalChunks: number
    failedChunks: string[]
  }) => void
}

export interface DistillationWorkflowResult {
  facts: DistilledStoryFacts
  complete: boolean
  failedChunks: string[]
  completedChunks: number
  totalChunks: number
  checkpoint: DistillationCheckpoint
  chunkTaskIds: string[]
}

/** VS5 map/reduce workflow with incremental checkpoint and partial-failure recovery. */
export class ProjectDistillationWorkflow {
  private readonly intelligence: CreativeIntelligence

  constructor(intelligence: CreativeIntelligence) {
    this.intelligence = intelligence
  }

  async run(
    input: ProjectDistillationInput,
    options: DistillationWorkflowOptions = {},
  ): Promise<DistillationWorkflowResult> {
    if (!input.taskId.trim()) throw new Error('Distillation task id must not be empty')
    if (input.documents.length === 0) throw new Error('Distillation requires at least one document')
    const requestedChunkSize = options.chunkSize ?? 20
    if (!Number.isFinite(requestedChunkSize) || requestedChunkSize <= 0) {
      throw new RangeError('Distillation chunk size must be a positive finite number')
    }
    const chunkSize = Math.max(1, Math.floor(requestedChunkSize))
    const chunks = chunk(input.documents, chunkSize)
    const totalChunks = chunks.length
    const previous = options.checkpoint
    const facts = cloneFacts(previous?.facts ?? emptyFacts())
    const completed = new Set(previous?.completedChunkIndexes ?? [])
    const failedIndexes = new Set(previous?.failedChunkIndexes ?? [])
    const failedIds = new Set(previous?.failedChunks ?? [])
    const chunkTaskIds: string[] = []
    const start = Math.max(0, Math.min(totalChunks, previous?.nextChunk ?? 0))

    for (let index = 0; index < totalChunks; index += 1) {
      if (
        (index < start && !failedIndexes.has(index)) ||
        (completed.has(index) && !failedIndexes.has(index))
      )
        continue
      if (options.signal?.aborted) throw new AbortError()
      const documents = chunks[index]
      const taskId = `${input.taskId}:chunk:${index}`
      chunkTaskIds.push(taskId)
      const chunkId = `${documents[0].documentId}:${documents.at(-1)?.documentId ?? documents[0].documentId}`
      try {
        const result = await this.intelligence.runDistillation(
          {
            taskId,
            workspaceId: input.workspaceId,
            document: documents[0],
            neighboringDocuments: documents.slice(1),
            target: input.target ?? 'project',
            fields: input.fields,
            storyState: input.storyState,
            instruction: input.instruction,
            metadata: {
              ...input.metadata,
              distillationChunk: index,
              distillationChunks: totalChunks,
            },
          },
          {
            signal: options.signal,
            pollIntervalMs: options.pollIntervalMs,
          },
        )
        mergeFacts(facts, result)
        completed.add(index)
        failedIndexes.delete(index)
        failedIds.delete(chunkId)
      } catch (error) {
        failedIndexes.add(index)
        failedIds.add(chunkId)
        const checkpoint = makeCheckpoint(
          index + (options.continueOnError ? 1 : 0),
          completed,
          failedIndexes,
          failedIds,
          facts,
        )
        await options.saveCheckpoint?.(checkpoint)
        reportProgress(options.onProgress, completed.size, totalChunks, [...failedIds])
        if (options.signal?.aborted) throw error
        if (!options.continueOnError) throw error
      }
      const checkpoint = makeCheckpoint(index + 1, completed, failedIndexes, failedIds, facts)
      await options.saveCheckpoint?.(checkpoint)
      reportProgress(options.onProgress, completed.size, totalChunks, [...failedIds])
    }

    const checkpoint = makeCheckpoint(totalChunks, completed, failedIndexes, failedIds, facts)
    await options.saveCheckpoint?.(checkpoint)
    return {
      facts: cloneFacts(facts),
      complete: failedIndexes.size === 0 && completed.size === totalChunks,
      failedChunks: [...failedIds],
      completedChunks: completed.size,
      totalChunks,
      checkpoint,
      chunkTaskIds,
    }
  }
}

function makeCheckpoint(
  nextChunk: number,
  completed: Set<number>,
  failedIndexes: Set<number>,
  failedIds: Set<string>,
  facts: DistilledStoryFacts,
): DistillationCheckpoint {
  return {
    nextChunk,
    completedChunkIndexes: [...completed].sort((left, right) => left - right),
    failedChunkIndexes: [...failedIndexes].sort((left, right) => left - right),
    failedChunks: [...failedIds].sort(),
    facts: cloneFacts(facts),
  }
}

function reportProgress(
  callback: DistillationWorkflowOptions['onProgress'],
  completedChunks: number,
  totalChunks: number,
  failedChunks: string[],
): void {
  callback?.({ completedChunks, totalChunks, failedChunks })
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size))
  return result
}

function emptyFacts(): DistilledStoryFacts {
  return { summary: '', entities: [], events: [], promises: [] }
}

function mergeFacts(target: DistilledStoryFacts, source: DistilledStoryFacts): void {
  target.summary = [target.summary, source.summary].filter(Boolean).join('\n\n')
  appendUnique(target.entities, source.entities, (item) => `${item.kind}:${item.id ?? item.name}`)
  appendUnique(
    target.events,
    source.events,
    (item) => `${item.type}:${item.id ?? item.description ?? ''}`,
  )
  appendUnique(target.promises, source.promises, (item) => `${item.id ?? item.statement}`)
  const confidences = [target.confidence, source.confidence].filter(
    (value): value is number => typeof value === 'number',
  )
  target.confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : undefined
}

function appendUnique<T>(target: T[], source: T[], key: (item: T) => string): void {
  const keys = new Set(target.map(key))
  for (const item of source) {
    const itemKey = key(item)
    if (keys.has(itemKey)) continue
    keys.add(itemKey)
    target.push(structuredClone(item))
  }
}

function cloneFacts(facts: DistilledStoryFacts): DistilledStoryFacts {
  return structuredClone(facts)
}

function linkedSignal(
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

class AbortError extends Error {
  constructor(message = 'Creative task was cancelled') {
    super(message)
    this.name = 'AbortError'
  }
}
