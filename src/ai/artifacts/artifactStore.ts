import type { AiTask, TaskResult, TaskOutput } from '@inkpi/protocol'
import { db } from '../../db/indexedDB'

export interface ArtifactProvenance {
  taskId?: string
  executionRunId?: string
  sessionId?: string
  parentArtifactId?: string
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
  content: TaskOutput
  contextFingerprint?: string
  provenance: ArtifactProvenance
  lineage?: {
    parentArtifactId?: string
    sourceTaskId: string
    sourceRevision?: number
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

export type CreativeArtifactType = (typeof CREATIVE_ARTIFACT_TYPES)[keyof typeof CREATIVE_ARTIFACT_TYPES]

export interface ArtifactStore {
  save(artifact: AiArtifact): Promise<void>
  get(id: string): Promise<AiArtifact | undefined>
  list(taskId?: string): Promise<AiArtifact[]>
  listByType?(type: string): Promise<AiArtifact[]>
}

export class IndexedDbArtifactStore implements ArtifactStore {
  async save(artifact: AiArtifact): Promise<void> {
    await db.put('aiArtifacts', artifact)
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

  constructor(store: ArtifactStore, now: () => number = Date.now) {
    this.store = store
    this.now = now
  }

  async persistTaskResult(
    task: AiTask,
    result: TaskResult,
    artifactId: string,
    options: { type?: string; version?: number; parentArtifactId?: string; sessionId?: string } = {},
  ): Promise<AiArtifact | undefined> {
    if (result.status !== 'completed' && result.status !== 'waiting-user') return undefined
    if (!result.output || task.outputContract?.persistence !== 'artifact') return undefined
    const createdAt = this.now()
    const artifact: AiArtifact = {
      id: artifactId,
      taskId: task.id,
      kind: task.kind,
      type: options.type || task.outputContract?.schemaId || defaultArtifactType(task.kind, result.output.format),
      version: options.version ?? 1,
      documentId: task.input.documentId,
      content: cloneOutput(result.output),
      contextFingerprint:
        typeof task.metadata?.contextFingerprint === 'string' ? task.metadata.contextFingerprint : undefined,
      provenance: {
        taskId: task.id,
        taskKind: task.kind,
        effectMode: task.effectPolicy?.mode || 'read-only',
        ...(options.parentArtifactId ? { parentArtifactId: options.parentArtifactId } : {}),
        ...(options.sessionId ? { sessionId: options.sessionId } : {}),
        ...(result.provenance || {}),
      },
      lineage: {
        parentArtifactId: options.parentArtifactId,
        sourceTaskId: task.id,
        sourceRevision: task.input.selection?.revision,
      },
      createdAt,
      updatedAt: this.now(),
      metadata: task.metadata,
    }
    await this.store.save(artifact)
    return artifact
  }
}

function defaultArtifactType(kind: string, format: TaskOutput['format']): string {
  if (kind === 'narrative.continuity.audit') return CREATIVE_ARTIFACT_TYPES.auditReport
  if (kind === 'narrative.project.distill') return CREATIVE_ARTIFACT_TYPES.distillationCheckpoint
  return `task-output/${format}`
}

function cloneOutput(output: TaskOutput): TaskOutput {
  if (output.format === 'text') return { format: 'text', text: output.text }
  if (output.format === 'patch') return { format: 'patch', patch: output.patch }
  return { format: 'structured', data: output.data }
}
