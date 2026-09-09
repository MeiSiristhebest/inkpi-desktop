import type { SemanticDocument } from '../../domain/content'
import { db } from '../../db/indexedDB'
import type { DistillationCheckpoint } from './verticalSlices'

export interface DistillationCheckpointStore {
  load(projectId: string, taskId: string, sourceFingerprint?: string): Promise<DistillationCheckpoint | undefined>
  save(projectId: string, taskId: string, checkpoint: DistillationCheckpoint, sourceFingerprint?: string): Promise<void>
  clear(projectId: string, taskId: string): Promise<void>
}

interface PersistedDistillationCheckpoint {
  key: string
  projectId: string
  taskId: string
  sourceFingerprint?: string
  checkpoint: DistillationCheckpoint
  updatedAt: number
}

const KEY_PREFIX = 'ai-distillation-checkpoint::'

export const distillationCheckpointKey = (projectId: string, taskId: string): string =>
  `${KEY_PREFIX}${encodeURIComponent(projectId)}::${encodeURIComponent(taskId)}`

/** IndexedDB-backed workflow checkpoint storage for app-restart recovery. */
export class IndexedDbDistillationCheckpointStore implements DistillationCheckpointStore {
  async load(projectId: string, taskId: string, sourceFingerprint?: string): Promise<DistillationCheckpoint | undefined> {
    const record = await db.get<PersistedDistillationCheckpoint>(
      'settingsKV',
      distillationCheckpointKey(projectId, taskId),
    )
    if (!isPersistedCheckpoint(record, projectId, taskId)) return undefined
    if (sourceFingerprint !== undefined && record.sourceFingerprint !== sourceFingerprint) return undefined
    return cloneCheckpoint(record.checkpoint)
  }

  async save(
    projectId: string,
    taskId: string,
    checkpoint: DistillationCheckpoint,
    sourceFingerprint?: string,
  ): Promise<void> {
    if (!projectId.trim()) throw new Error('Distillation checkpoint project id must not be empty')
    if (!taskId.trim()) throw new Error('Distillation checkpoint task id must not be empty')
    if (!isCheckpoint(checkpoint)) throw new Error('Invalid distillation checkpoint')
    await db.put<PersistedDistillationCheckpoint>('settingsKV', {
      key: distillationCheckpointKey(projectId, taskId),
      projectId,
      taskId,
      ...(sourceFingerprint ? { sourceFingerprint } : {}),
      checkpoint: cloneCheckpoint(checkpoint),
      updatedAt: Date.now(),
    })
  }

  clear(projectId: string, taskId: string): Promise<void> {
    return db.delete('settingsKV', distillationCheckpointKey(projectId, taskId))
  }
}

export const indexedDbDistillationCheckpointStore = new IndexedDbDistillationCheckpointStore()

/** Stable source identity used to reject a checkpoint from a different project revision. */
export function createDistillationSourceFingerprint(documents: readonly SemanticDocument[]): string {
  return hash(stableSerialize(documents))
}

function isPersistedCheckpoint(
  value: unknown,
  projectId: string,
  taskId: string,
): value is PersistedDistillationCheckpoint {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<PersistedDistillationCheckpoint>
  return record.key === distillationCheckpointKey(projectId, taskId)
    && record.projectId === projectId
    && record.taskId === taskId
    && Number.isFinite(record.updatedAt)
    && isCheckpoint(record.checkpoint)
}

function isCheckpoint(value: unknown): value is DistillationCheckpoint {
  if (!value || typeof value !== 'object') return false
  const checkpoint = value as Partial<DistillationCheckpoint>
  const nextChunk = checkpoint.nextChunk
  return isIntegerArray(checkpoint.completedChunkIndexes)
    && isIntegerArray(checkpoint.failedChunkIndexes)
    && Array.isArray(checkpoint.failedChunks)
    && checkpoint.failedChunks.every((item) => typeof item === 'string')
    && typeof nextChunk === 'number'
    && Number.isInteger(nextChunk)
    && nextChunk >= 0
    && isFacts(checkpoint.facts)
}

function isFacts(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const facts = value as Record<string, unknown>
  return typeof facts.summary === 'string'
    && Array.isArray(facts.entities)
    && Array.isArray(facts.events)
    && Array.isArray(facts.promises)
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0)
}

function cloneCheckpoint(checkpoint: DistillationCheckpoint): DistillationCheckpoint {
  return structuredClone(checkpoint)
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

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}
