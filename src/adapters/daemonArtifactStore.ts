import type { Artifact as RuntimeArtifact } from '@inkpi/protocol'
import type { RpcClient } from '../ports/aiGateway'
import type { AiArtifact, ArtifactStore } from '../ai/artifacts'

const DESKTOP_ARTIFACT_METADATA = '__inkpiDesktopArtifact'

/** Projects desktop artifact metadata into the Runtime artifact RPC boundary. */
export class DaemonArtifactStore implements ArtifactStore {
  private readonly client: RpcClient

  constructor(client: RpcClient) {
    this.client = client
  }

  async save(artifact: AiArtifact): Promise<void> {
    await this.client.request('artifact.save', { artifact: toRuntimeArtifact(artifact) })
  }

  async get(id: string): Promise<AiArtifact | undefined> {
    const artifact = await this.client.request<RuntimeArtifact | undefined>('artifact.get', { id })
    return artifact ? fromRuntimeArtifact(artifact) : undefined
  }

  async list(taskId?: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<RuntimeArtifact[]>('artifact.list', { taskId })
    return artifacts.map(fromRuntimeArtifact)
  }

  async listByType(type: string): Promise<AiArtifact[]> {
    const artifacts = await this.client.request<RuntimeArtifact[]>('artifact.list', { type })
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

function fromRuntimeArtifact(artifact: RuntimeArtifact): AiArtifact {
  const metadata = asRecord(artifact.provenance[DESKTOP_ARTIFACT_METADATA])
  const { [DESKTOP_ARTIFACT_METADATA]: _desktopMetadata, ...provenance } = artifact.provenance
  return {
    ...artifact,
    taskId: readString(metadata?.taskId) ?? readString(artifact.provenance.taskId) ?? `artifact:${artifact.id}`,
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
