import type { AiTask, TaskResult, TaskOutput } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'
import type { IdGenerator } from '../../ports/idGenerator'

export interface ArtifactProvenance {
  taskId?: string
  executionRunId?: string
  sessionId?: string
  parentArtifactId?: string
  sourceRevision?: number
  [key: string]: unknown
}

/** Runtime semantic object. File formats are export concerns, not storage types. */
export interface Artifact {
  id: string
  type: string
  version: number
  content: unknown
  provenance: ArtifactProvenance
  createdAt: number
  updatedAt: number
}

export interface AiArtifact extends Artifact {
  taskId: string
  kind: string
  /** Stable semantic artifact type, independent from the task kind. */
  documentId?: string
  /** Semantic payload. Output format envelopes are not persisted as artifact content. */
  content: unknown
  contextFingerprint?: string
  provenance: ArtifactProvenance
  lineage?: {
    parentArtifactId?: string
    taskId?: string
    sourceTaskId: string
    sourceRevision?: number
    executionRunId?: string
  }
  metadata?: Record<string, unknown>
}

export const CREATIVE_ARTIFACT_TYPES = {
  storyPlan: 'creative.story-plan',
  characterState: 'creative.character-state',
  openThreads: 'creative.open-threads',
  chapterSummary: 'creative.chapter-summary',
  auditReport: 'creative.audit-report',
  distillationCheckpoint: 'creative.distillation-checkpoint',
} as const

export type CreativeArtifactType =
  (typeof CREATIVE_ARTIFACT_TYPES)[keyof typeof CREATIVE_ARTIFACT_TYPES]

export type ArtifactIdGenerator = IdGenerator | ((prefix: string) => string)

const artifactStoreLocks = new WeakMap<object, Map<string, Promise<unknown>>>()

export interface ArtifactPersistenceOptions {
  type?: string
  version?: number
  parentArtifactId?: string
  sourceRevision?: number
  sessionId?: string
  executionRunId?: string
  idGenerator?: ArtifactIdGenerator
}

export class ArtifactConflictError extends Error {
  readonly code = 'ARTIFACT_CONFLICT'
  readonly existingArtifact: AiArtifact
  readonly incomingArtifact: AiArtifact

  constructor(existingArtifact: AiArtifact, incomingArtifact: AiArtifact) {
    super(`Artifact ${incomingArtifact.id} already exists with incompatible content`)
    this.name = 'ArtifactConflictError'
    this.existingArtifact = existingArtifact
    this.incomingArtifact = incomingArtifact
  }
}

export interface ArtifactStore {
  save(artifact: AiArtifact): Promise<void>
  get(id: string): Promise<AiArtifact | undefined>
  list(taskId?: string): Promise<AiArtifact[]>
  listByType?(type: string): Promise<AiArtifact[]>
}

export class IndexedDbArtifactStore implements ArtifactStore {
  private static readonly saveLocks = new Map<string, Promise<void>>()

  async save(artifact: AiArtifact): Promise<void> {
    const previous = IndexedDbArtifactStore.saveLocks.get(artifact.id) ?? Promise.resolve()
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const existing = await this.get(artifact.id)
        if (existing) {
          assertCompatibleArtifact(existing, artifact)
          return
        }
        await db.put('aiArtifacts', artifact)
      })
    IndexedDbArtifactStore.saveLocks.set(artifact.id, current)
    try {
      await current
    } finally {
      if (IndexedDbArtifactStore.saveLocks.get(artifact.id) === current) {
        IndexedDbArtifactStore.saveLocks.delete(artifact.id)
      }
    }
  }

  get(id: string): Promise<AiArtifact | undefined> {
    return db.get<AiArtifact>('aiArtifacts', id)
  }

  async list(taskId?: string): Promise<AiArtifact[]> {
    const artifacts = await db.getAll<AiArtifact>('aiArtifacts')
    return artifacts
      .filter((artifact) => !taskId || artifact.taskId === taskId)
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  async listByType(type: string): Promise<AiArtifact[]> {
    const artifacts = await db.getAll<AiArtifact>('aiArtifacts')
    return artifacts
      .filter((artifact) => artifact.type === type)
      .sort((left, right) => left.createdAt - right.createdAt)
  }
}

export class ArtifactRuntime {
  private readonly store: ArtifactStore
  private readonly now: () => number
  private readonly idGenerator?: ArtifactIdGenerator
  private readonly pendingSaves = new Map<string, Promise<AiArtifact>>()

  constructor(
    store: ArtifactStore,
    nowOrOptions:
      (() => number) | { now?: () => number; idGenerator?: ArtifactIdGenerator } = Date.now,
    idGenerator?: ArtifactIdGenerator,
  ) {
    this.store = store
    if (typeof nowOrOptions === 'function') {
      this.now = nowOrOptions
      this.idGenerator = idGenerator
    } else {
      this.now = nowOrOptions.now ?? Date.now
      this.idGenerator = nowOrOptions.idGenerator
    }
  }

  async persistTaskResult(
    task: AiTask,
    result: TaskResult,
    artifactId?: string,
    options: ArtifactPersistenceOptions = {},
  ): Promise<AiArtifact | undefined> {
    if (result.status !== 'completed' && result.status !== 'waiting-user') return undefined
    if (!result.output || task.outputContract?.persistence !== 'artifact') return undefined

    const resolvedArtifactId =
      artifactId ||
      result.artifactIds?.[0] ||
      generateArtifactId(task, options.idGenerator ?? this.idGenerator)
    const parentArtifactId =
      options.parentArtifactId ??
      readLineageString(task, 'parentArtifactId') ??
      readString(result.provenance, 'parentArtifactId')
    const sourceRevision =
      options.sourceRevision ??
      readLineageNumber(task, 'sourceRevision') ??
      readNumber(result.provenance, 'sourceRevision') ??
      task.input.selection?.revision ??
      readContextNumber(task, 'revision')
    const sessionId =
      options.sessionId ??
      readLineageString(task, 'sessionId') ??
      readString(result.provenance, 'sessionId')
    const executionRunId =
      options.executionRunId ??
      readLineageString(task, 'executionRunId') ??
      readString(result.provenance, 'executionRunId')
    const createdAt = this.now()
    const artifact: AiArtifact = {
      id: resolvedArtifactId,
      taskId: task.id,
      kind: task.kind,
      type:
        options.type ||
        readString(task.metadata, 'artifactType') ||
        task.outputContract?.schemaId ||
        defaultArtifactType(task.kind),
      version: options.version ?? readNumber(task.metadata, 'artifactVersion') ?? 1,
      documentId: task.input.documentId,
      content: cloneOutputContent(result.output),
      contextFingerprint:
        readString(task.metadata, 'contextFingerprint') ??
        readString(task.contextPolicy?.metadata, 'contextFingerprint') ??
        readContextString(task, 'fingerprint') ??
        readString(result.provenance, 'contextFingerprint'),
      provenance: {
        ...(result.provenance || {}),
        taskId: task.id,
        taskKind: task.kind,
        effectMode: task.effectPolicy?.mode || 'read-only',
        ...(executionRunId ? { executionRunId } : {}),
        ...(parentArtifactId ? { parentArtifactId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(sourceRevision === undefined ? {} : { sourceRevision }),
      },
      lineage: {
        ...(parentArtifactId ? { parentArtifactId } : {}),
        taskId: task.id,
        sourceTaskId: task.id,
        ...(sourceRevision === undefined ? {} : { sourceRevision }),
        ...(executionRunId ? { executionRunId } : {}),
      },
      createdAt,
      updatedAt: this.now(),
      metadata: cloneRecord(task.metadata),
    }

    const pending = this.pendingSaves.get(artifact.id)
    if (pending) {
      const existing = await pending
      assertCompatibleArtifact(existing, artifact)
      return existing
    }

    const save = this.persistArtifact(artifact)
    this.pendingSaves.set(artifact.id, save)
    try {
      return await save
    } finally {
      if (this.pendingSaves.get(artifact.id) === save) this.pendingSaves.delete(artifact.id)
    }
  }

  private async persistArtifact(artifact: AiArtifact): Promise<AiArtifact> {
    return withArtifactStoreLock(this.store, artifact.id, async () => {
      const existing = await this.store.get(artifact.id)
      if (existing) {
        assertCompatibleArtifact(existing, artifact)
        return existing
      }
      await this.store.save(artifact)
      const persisted = await this.store.get(artifact.id)
      if (persisted) {
        assertCompatibleArtifact(persisted, artifact)
        return persisted
      }
      return artifact
    })
  }
}

function defaultArtifactType(kind: string): string {
  if (kind === 'narrative.continuity.audit') return CREATIVE_ARTIFACT_TYPES.auditReport
  if (kind === 'narrative.project.distill') return CREATIVE_ARTIFACT_TYPES.distillationCheckpoint
  return `creative.${kind.replace(/^[^.]+\./, '').replace(/\./g, '-')}`
}

function cloneOutputContent(output: TaskOutput): unknown {
  if (output.format === 'text') return output.text
  if (output.format === 'patch') return cloneValue(output.patch)
  return cloneValue(output.data)
}

function generateArtifactId(task: AiTask, generator?: ArtifactIdGenerator): string {
  if (generator) {
    return typeof generator === 'function' ? generator('artifact') : generator.generate('artifact')
  }
  return `artifact-${task.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function assertCompatibleArtifact(existing: AiArtifact, incoming: AiArtifact): void {
  if (stableSerialize(artifactIdentity(existing)) !== stableSerialize(artifactIdentity(incoming))) {
    throw new ArtifactConflictError(existing, incoming)
  }
}

async function withArtifactStoreLock<T>(
  store: ArtifactStore,
  id: string,
  operation: () => Promise<T>,
): Promise<T> {
  const locks = artifactStoreLocks.get(store) ?? new Map<string, Promise<unknown>>()
  artifactStoreLocks.set(store, locks)
  const previous = locks.get(id)
  const current = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(operation)
  locks.set(id, current)
  try {
    return await current
  } finally {
    if (locks.get(id) === current) locks.delete(id)
    if (locks.size === 0) artifactStoreLocks.delete(store)
  }
}

function artifactIdentity(artifact: AiArtifact): Record<string, unknown> {
  return {
    type: artifact.type,
    version: artifact.version,
    content: artifact.content,
  }
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readLineageString(task: AiTask, key: string): string | undefined {
  const metadata = task.metadata
  const lineage = asRecord(metadata?.lineage)
  const payload = asRecord(task.input.payload)
  const payloadLineage = asRecord(payload?.lineage)
  return firstString(metadata?.[key], lineage?.[key], payload?.[key], payloadLineage?.[key])
}

function readLineageNumber(task: AiTask, key: string): number | undefined {
  const metadata = task.metadata
  const lineage = asRecord(metadata?.lineage)
  const payload = asRecord(task.input.payload)
  const payloadLineage = asRecord(payload?.lineage)
  return firstNumber(metadata?.[key], lineage?.[key], payload?.[key], payloadLineage?.[key])
}

function readContextNumber(task: AiTask, key: string): number | undefined {
  const payload = asRecord(task.input.payload)
  const context = asRecord(payload?.context)
  return readNumber(context, key)
}

function readContextString(task: AiTask, key: string): string | undefined {
  const payload = asRecord(task.input.payload)
  const context = asRecord(payload?.context)
  return readString(context, key)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
}

function cloneRecord(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return record ? (cloneValue(record) as Record<string, unknown>) : undefined
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fall through for values that are not structured-cloneable.
    }
  }
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>))
    result[key] = cloneValue(item)
  return result as T
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}
