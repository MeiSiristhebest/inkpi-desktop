import type { Artifact as RuntimeArtifact } from '@inkpi/protocol'
import type { RpcClient } from '../ports/aiGateway'
import {
  assertAiArtifact,
  assertArtifactOwnership,
  normalizeArtifactForPersistence,
  normalizeDesktopArtifact,
} from '../ai/artifacts'
import type { AiArtifact, ArtifactOwnership, ArtifactStore } from '../ai/artifacts'
import { artifactEvents } from '../ports/artifactEvents'

const DESKTOP_ARTIFACT_METADATA = '__inkpiDesktopArtifact'

/** Projects desktop artifact metadata into the Runtime artifact RPC boundary. */
export class DaemonArtifactStore implements ArtifactStore {
  private readonly client: RpcClient

  constructor(client: RpcClient) {
    this.client = client
  }

  async save(artifact: AiArtifact): Promise<void> {
    const normalized = normalizeDesktopArtifact(artifact)
    const result = await this.client.request<unknown>('artifact.save', {
      artifact: toRuntimeArtifact(normalized),
    })
    if (!isRecord(result) || result.saved !== true || result.id !== normalized.id) {
      throw new Error(`Daemon artifact save returned an invalid receipt for ${normalized.id}`)
    }
    artifactEvents.publish({
      artifactId: normalized.id,
      workspaceId:
        normalized.ownership?.workspaceId ??
        (normalized.metadata?.workspaceId as string | undefined),
      action: 'updated',
    })
  }

  async get(id: string): Promise<AiArtifact | undefined> {
    const artifact = await this.client.request<unknown>('artifact.get', { id })
    return artifact ? fromRuntimeArtifact(artifact) : undefined
  }

  async list(taskId?: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<unknown>('artifact.list', { taskId })
    if (!Array.isArray(artifacts)) throw new Error('Daemon artifact list returned an invalid list')
    return artifacts.map((artifact) => fromRuntimeArtifact(artifact))
  }

  async listByType(type: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<unknown>('artifact.list', { type })
    if (!Array.isArray(artifacts)) throw new Error('Daemon artifact list returned an invalid list')
    return artifacts.map((artifact) => fromRuntimeArtifact(artifact))
  }

  async listByWorkspace(workspaceId: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<unknown>('artifact.list', { workspaceId })
    if (!Array.isArray(artifacts)) throw new Error('Daemon artifact list returned an invalid list')
    return artifacts.map((art) => fromRuntimeArtifact(art, workspaceId))
  }
}

function toRuntimeArtifact(artifact: AiArtifact): RuntimeArtifact {
  const workspaceId =
    artifact.ownership?.workspaceId ?? (artifact.metadata?.workspaceId as string | undefined)
  return {
    id: artifact.id,
    type: artifact.type,
    version: artifact.version,
    content: artifact.content,
    ...(workspaceId ? { workspaceId } : {}),
    provenance: {
      ...artifact.provenance,
      [DESKTOP_ARTIFACT_METADATA]: {
        taskId: artifact.taskId,
        kind: artifact.kind,
        ...(artifact.documentId ? { documentId: artifact.documentId } : {}),
        ...(artifact.contextFingerprint ? { contextFingerprint: artifact.contextFingerprint } : {}),
        ...(artifact.lineage ? { lineage: artifact.lineage } : {}),
        ...(artifact.ownership ? { ownership: artifact.ownership } : {}),
        ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
      },
    },
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  }
}

function fromRuntimeArtifact(artifact: unknown, fallbackWorkspaceId?: string): AiArtifact {
  assertRuntimeArtifact(artifact)
  const metadata = asRecord(artifact.provenance[DESKTOP_ARTIFACT_METADATA])
  const { [DESKTOP_ARTIFACT_METADATA]: _desktopMetadata, ...provenance } = artifact.provenance
  const workspaceId =
    (artifact as any).workspaceId ??
    asRecord(metadata?.ownership)?.workspaceId ??
    fallbackWorkspaceId
  const normalized = normalizeArtifactForPersistence({
    ...artifact,
    taskId:
      readString(metadata?.taskId) ??
      readString(artifact.provenance.taskId) ??
      `artifact:${artifact.id}`,
    kind: readString(metadata?.kind) ?? readString(artifact.provenance.taskKind) ?? artifact.type,
    ...(readString(metadata?.documentId) ? { documentId: readString(metadata?.documentId) } : {}),
    ...(readString(metadata?.contextFingerprint)
      ? { contextFingerprint: readString(metadata?.contextFingerprint) }
      : {}),
    ...(metadata?.lineage && typeof metadata.lineage === 'object'
      ? { lineage: metadata.lineage as AiArtifact['lineage'] }
      : {}),
    ...(metadata?.metadata && typeof metadata.metadata === 'object'
      ? { metadata: metadata.metadata as Record<string, unknown> }
      : {}),
    ownership: daemonOwnership(metadata?.ownership, workspaceId),
    provenance,
  })
  assertAiArtifact(normalized)
  return normalized
}

function assertRuntimeArtifact(value: unknown): asserts value is RuntimeArtifact {
  if (!isRecord(value)) throw new Error('Daemon artifact is not an object')
  const version = value.version
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.type !== 'string' ||
    !value.type.trim() ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !isRecord(value.provenance) ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    throw new Error(
      `Daemon artifact ${typeof value.id === 'string' ? value.id : '<unknown>'} is invalid`,
    )
  }
}

function daemonOwnership(value: unknown, fallbackWorkspaceId?: string): ArtifactOwnership {
  if (value !== undefined) assertArtifactOwnership(value)
  const workspaceId = asRecord(value)?.workspaceId ?? fallbackWorkspaceId
  return {
    owner: 'daemon',
    authoritative: false,
    ...(typeof workspaceId === 'string' && workspaceId.trim() ? { workspaceId } : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
