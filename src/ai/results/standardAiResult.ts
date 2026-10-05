import type { TaskScope } from '../../types/taskScope'
import type { AiArtifact } from '../artifacts/artifactStore'
import { artifactWorkspaceId } from '../artifacts/artifactStore'
import type { AiProposal, ProposalStatus } from '../proposals/proposalLedger'
import type {
  AiResultFinding,
  AiResultLifecycleStatus,
  StandardAiResult,
} from '../../types/aiResultLifecycle'

const TASK_KIND_LABELS: Record<string, string> = {
  'narrative.deep.reason': '深度思考',
  'narrative.project.distill': '项目整理',
  'narrative.continuity.audit': '一致性体检',
}

/** Labels for the lifecycle badge. `running` and `requested` never appear here. */
export const LIFECYCLE_LABELS: Record<AiResultLifecycleStatus, string> = {
  requested: '已提交',
  running: '执行中',
  result: '待审阅',
  accepted: '已采纳',
  committed: '已落盘',
  dismissed: '已忽略',
  undone: '已撤销',
}

export function humanizeTaskKind(kind: string): string {
  return TASK_KIND_LABELS[kind] ?? kind.replace(/^plugin\./, '').replace(/[._-]+/g, ' ')
}

/**
 * `stale` keeps a result awaiting review rather than giving it a status of its
 * own: the base revision moved, so the author still has to decide, exactly as
 * for a fresh `pending` proposal.
 */
export function lifecycleStatusForProposal(
  status: ProposalStatus | undefined,
): AiResultLifecycleStatus {
  switch (status) {
    case 'accepted':
      return 'accepted'
    case 'committed':
      return 'committed'
    case 'undone':
      return 'undone'
    case 'rejected':
      return 'dismissed'
    case 'pending':
    case 'stale':
    case undefined:
      return 'result'
  }
}

/**
 * Joins persisted artifacts with the proposals that record the author's decision
 * on them. Proposals are document-scoped, so callers pass only the proposals
 * already resolved to belong to this workspace.
 */
export function projectWorkspaceResults(
  artifacts: readonly AiArtifact[],
  proposals: readonly AiProposal[],
): StandardAiResult[] {
  const proposalByTask = new Map<string, AiProposal>()
  for (const proposal of proposals) {
    const current = proposalByTask.get(proposal.taskId)
    if (!current || (proposal.updatedAt ?? 0) > (current.updatedAt ?? 0)) {
      proposalByTask.set(proposal.taskId, proposal)
    }
  }
  return artifacts
    .map((artifact) =>
      projectArtifactToStandardAiResult(artifact, proposalByTask.get(artifact.taskId)),
    )
    .filter((result): result is StandardAiResult => result !== undefined)
    .sort((left, right) => right.createdAt - left.createdAt)
}

/**
 * Projects a stored artifact into the unified result contract. Returns undefined
 * for an artifact with no workspace, because an unscoped result has no business
 * appearing in any project's Result Center (INV-03).
 */
export function projectArtifactToStandardAiResult(
  artifact: AiArtifact,
  proposal?: AiProposal,
): StandardAiResult | undefined {
  const workspaceId = artifactWorkspaceId(artifact)
  if (!workspaceId) return undefined

  const sourceRevision = readNumber(artifact.provenance, 'sourceRevision')
  const scope: TaskScope = {
    workspaceId,
    workspaceRevision: readNumber(artifact.provenance, 'projectRevision') ?? 1,
  }
  const documentId = proposal?.documentId ?? artifact.documentId
  if (documentId) {
    scope.document = { id: documentId, revision: proposal?.baseRevision ?? sourceRevision ?? 1 }
  }
  const patch = proposal?.patches[0]
  if (patch) scope.selection = { from: patch.from, to: patch.to }
  const sessionId = readString(artifact.provenance, 'sessionId')
  if (sessionId) scope.sessionId = sessionId

  const usage = asRecord(artifact.provenance.usage)
  const contextSources = artifact.provenance.contextSources
  const result: StandardAiResult = {
    id: artifact.id,
    taskId: artifact.taskId,
    scope,
    kind: artifact.kind,
    title: readString(artifact.metadata, 'title') ?? humanizeTaskKind(artifact.kind),
    summary: summarizeContent(artifact.content),
    status: lifecycleStatusForProposal(proposal?.status),
    data: artifact.content,
    provenance: {
      provider: readString(artifact.provenance, 'provider'),
      model: readString(artifact.provenance, 'model'),
      latencyMs: readNumber(artifact.provenance, 'latencyMs'),
      inputTokens: readNumber(usage, 'inputTokens'),
      outputTokens: readNumber(usage, 'outputTokens'),
      sourceRevision: proposal?.baseRevision ?? sourceRevision,
      contextSourcesCount: Array.isArray(contextSources) ? contextSources.length : undefined,
      cacheHit:
        typeof artifact.provenance.cacheHit === 'boolean'
          ? artifact.provenance.cacheHit
          : undefined,
      timestamp: artifact.createdAt,
    },
    createdAt: artifact.createdAt,
    updatedAt: Math.max(artifact.updatedAt, proposal?.updatedAt ?? 0),
  }
  const findings = findingsFromProposal(proposal)
  if (findings) result.findings = findings
  if (proposal) result.proposalId = proposal.id
  return result
}

function findingsFromProposal(proposal: AiProposal | undefined): AiResultFinding[] | undefined {
  if (!proposal?.evidence?.length) return undefined
  return proposal.evidence.map((evidence, index) => {
    const finding: AiResultFinding = {
      id: `${proposal.id}-e${index}`,
      title: evidence.blockId ?? evidence.documentId ?? '依据',
      description: evidence.excerpt ?? '',
    }
    if (evidence.documentId || evidence.semanticFrom !== undefined) {
      finding.location = {
        ...(evidence.documentId ? { chapterId: evidence.documentId } : {}),
        ...(evidence.semanticFrom === undefined ? {} : { from: evidence.semanticFrom }),
        ...(evidence.semanticTo === undefined ? {} : { to: evidence.semanticTo }),
      }
    }
    return finding
  })
}

function summarizeContent(content: unknown): string {
  if (typeof content === 'string') return firstLine(content)
  const record = asRecord(content)
  return firstLine(readString(record, 'summary') ?? readString(record, 'text') ?? '')
}

function firstLine(value: string): string {
  const line = value.trim().split('\n', 1)[0] ?? ''
  return line.length > 160 ? `${line.slice(0, 157)}…` : line
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
