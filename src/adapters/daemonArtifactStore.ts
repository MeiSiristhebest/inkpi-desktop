import type { Artifact as RuntimeArtifact } from '@inkpi/protocol'
import type { RpcClient } from '../ports/aiGateway'
import { normalizeArtifactForPersistence } from '../ai/artifacts'
import type { AiArtifact, ArtifactStore } from '../ai/artifacts'

const DESKTOP_ARTIFACT_METADATA = '__inkpiDesktopArtifact'

/** Projects desktop artifact metadata into the Runtime artifact RPC boundary. */
export class DaemonArtifactStore implements ArtifactStore {
  private readonly client: RpcClient

  constructor(client: RpcClient) {
    this.client = client
  }

  async save(artifact: AiArtifact): Promise<void> {
    const normalized = normalizeArtifactForPersistence(artifact)
    const result = await this.client.request<unknown>('artifact.save', {
      artifact: toRuntimeArtifact(normalized),
    })
    if (!isRecord(result) || result.saved !== true || result.id !== normalized.id) {
      throw new Error(`Daemon artifact save returned an invalid receipt for ${normalized.id}`)
    }
  }

  async get(id: string): Promise<AiArtifact | undefined> {
    const artifact = await this.client.request<unknown>('artifact.get', { id })
    return artifact ? fromRuntimeArtifact(artifact) : undefined
  }

  async list(taskId?: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<unknown>('artifact.list', { taskId })
    if (!Array.isArray(artifacts)) throw new Error('Daemon artifact list returned an invalid list')
    return artifacts.map(fromRuntimeArtifact)
  }

  async listByType(type: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<unknown>('artifact.list', { type })
    if (!Array.isArray(artifacts)) throw new Error('Daemon artifact list returned an invalid list')
    return artifacts.map(fromRuntimeArtifact)
  }
}

function toRuntimeArtifact(artifact: AiArtifact): RuntimeArtifact {
  return {
    id: artifact.id,
    type: artifact.type,
    version: artifact.version,
    content: artifact.content,
    provenance: {
      ...artifact.provenance,
      [DESKTOP_ARTIFACT_METADATA]: {
        taskId: artifact.taskId,
        kind: artifact.kind,
        ...(artifact.documentId ? { documentId: artifact.documentId } : {}),
        ...(artifact.contextFingerprint ? { contextFingerprint: artifact.contextFingerprint } : {}),
        ...(artifact.lineage ? { lineage: artifact.lineage } : {}),
        ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
      },
    },
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  }
}

function fromRuntimeArtifact(artifact: unknown): AiArtifact {
  assertRuntimeArtifact(artifact)
  const metadata = asRecord(artifact.provenance[DESKTOP_ARTIFACT_METADATA])
  const { [DESKTOP_ARTIFACT_METADATA]: _desktopMetadata, ...provenance } = artifact.provenance
  return normalizeArtifactForPersistence({
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
    provenance,
  })
}

function assertRuntimeArtifact(value: unknown): asserts value is RuntimeArtifact {
  if (!isRecord(value)) throw new Error('Daemon artifact is not an object')
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.type !== 'string' ||
    !value.type.trim() ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
