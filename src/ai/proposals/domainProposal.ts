import {
  type DomainProposal,
  type DomainProposalEvidence,
  validateDomainProposal as validateSharedDomainProposal,
} from '@inkpi/protocol'
import type { AiProposal, TextPatch } from './proposalLedger'

export type { DomainProposal, DomainProposalEvidence } from '@inkpi/protocol'

export interface DomainProposalToAiProposalOptions {
  status: AiProposal['status']
  createdAt: number
  updatedAt?: number
  inversePatch?: unknown
  committedRevision?: number
}

/**
 * Validates the shared contract and the text-domain evidence shape at the
 * Desktop boundary. The Runtime contract stays domain-neutral; this adapter
 * only adds the checks needed before a text proposal crosses the wire.
 */
export function validateDomainProposal(proposal: DomainProposal): void {
  if (!isRecord(proposal)) throw new Error('Domain proposal must be an object')
  if (typeof proposal.id !== 'string' || typeof proposal.taskId !== 'string') {
    throw new Error('Domain proposal identifiers must be strings')
  }
  if (!Number.isInteger(proposal.baseRevision) || proposal.baseRevision < 0) {
    throw new Error('Domain proposal base revision must be a non-negative integer')
  }
  if (!isRecord(proposal.target)) {
    throw new Error('Domain proposal target must identify a domain object')
  }
  if (typeof proposal.target.type !== 'string' || typeof proposal.target.id !== 'string') {
    throw new Error('Domain proposal target must identify a domain object')
  }
  if (!['create', 'update', 'delete'].includes(proposal.operation)) {
    throw new Error('Domain proposal operation is invalid')
  }
  if (proposal.evidence !== undefined && !Array.isArray(proposal.evidence)) {
    throw new Error('Domain proposal evidence must be an array')
  }

  validateSharedDomainProposal(proposal)
  validateEvidence(proposal.evidence)
}

/** Converts the Desktop text ledger shape into the shared domain-neutral shape. */
export function aiProposalToDomainProposal(
  proposal: AiProposal,
  evidence?: DomainProposalEvidence[],
): DomainProposal {
  const patches = requireTextPatches(proposal.patches, proposal.documentId)

  const domainProposal: DomainProposal = {
    id: proposal.id,
    taskId: proposal.taskId,
    baseRevision: proposal.baseRevision,
    target: { type: 'document', id: proposal.documentId },
    operation: 'update',
    patch: patches,
    ...(proposal.sourceHash === undefined ? {} : { sourceHash: proposal.sourceHash }),
    ...(proposal.explanation === undefined ? {} : { reason: proposal.explanation }),
    ...(evidence === undefined ? {} : { evidence: evidence.map(cloneEvidence) }),
  }
  validateDomainProposal(domainProposal)
  return cloneDomainProposal(domainProposal)
}

/** Converts a document update back to the legacy Desktop text proposal shape. */
export function domainProposalToAiProposal(
  proposal: DomainProposal,
  options: DomainProposalToAiProposalOptions,
): AiProposal {
  validateDomainProposal(proposal)
  if (proposal.target.type !== 'document') {
    throw new Error('Text proposal bridge only supports document targets')
  }
  if (proposal.operation !== 'update') {
    throw new Error('Text proposal bridge only supports update operations')
  }

  const patches = requireTextPatches(proposal.patch, proposal.target.id)
  const inversePatches =
    options.inversePatch === undefined
      ? undefined
      : requireTextPatches(options.inversePatch, proposal.target.id)
  validateAiProposalMetadata(options)

  return {
    id: proposal.id,
    taskId: proposal.taskId,
    documentId: proposal.target.id,
    baseRevision: proposal.baseRevision,
    patches,
    ...(proposal.reason === undefined ? {} : { explanation: proposal.reason }),
    status: options.status,
    createdAt: options.createdAt,
    ...(options.updatedAt === undefined ? {} : { updatedAt: options.updatedAt }),
    ...(proposal.sourceHash === undefined ? {} : { sourceHash: proposal.sourceHash }),
    ...(inversePatches === undefined ? {} : { inversePatches }),
    ...(options.committedRevision === undefined
      ? {}
      : { committedRevision: options.committedRevision }),
  }
}

/** Serializes a validated proposal with deterministic object-key ordering. */
export function serializeDomainProposal(proposal: DomainProposal): string {
  validateDomainProposal(proposal)
  const serialized = JSON.stringify(canonicalize(proposal))
  if (serialized === undefined) throw new Error('Domain proposal is not serializable')
  return serialized
}

/** Parses and validates a JSON proposal received from a persistence or wire boundary. */
export function deserializeDomainProposal(serialized: string): DomainProposal {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('Serialized domain proposal is not valid JSON')
  }
  validateDomainProposal(parsed as DomainProposal)
  return cloneDomainProposal(parsed as DomainProposal)
}

function validateEvidence(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value)) throw new Error('Domain proposal evidence must be an array')

  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`Domain proposal evidence at index ${index} must be an object`)
    }
    for (const key of ['documentId', 'blockId', 'excerpt']) {
      if (candidate[key] !== undefined && typeof candidate[key] !== 'string') {
        throw new Error(`Domain proposal evidence ${key} at index ${index} must be a string`)
      }
    }
    for (const key of ['semanticFrom', 'semanticTo']) {
      const range = candidate[key]
      if (
        range !== undefined &&
        (!Number.isSafeInteger(range) || (range as number) < 0)
      ) {
        throw new Error(
          `Domain proposal evidence ${key} at index ${index} must be a non-negative integer`,
        )
      }
    }
    if (
      typeof candidate.semanticFrom === 'number' &&
      typeof candidate.semanticTo === 'number' &&
      candidate.semanticTo < candidate.semanticFrom
    ) {
      throw new Error(`Domain proposal evidence range at index ${index} is inverted`)
    }
  })
}

function requireTextPatches(value: unknown, documentId: string): TextPatch[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Text proposal requires at least one patch')
  }

  let previousTo = -1
  return value.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`Text proposal patch at index ${index} must be an object`)
    }
    if (
      candidate.documentId !== undefined &&
      (typeof candidate.documentId !== 'string' || candidate.documentId !== documentId)
    ) {
      throw new Error(`Text proposal patch at index ${index} targets another document`)
    }
    if (
      !Number.isInteger(candidate.from) ||
      !Number.isInteger(candidate.to) ||
      (candidate.from as number) < 0 ||
      (candidate.to as number) < (candidate.from as number) ||
      typeof candidate.text !== 'string'
    ) {
      throw new Error(`Text proposal patch at index ${index} is invalid`)
    }
    if ((candidate.from as number) < previousTo) {
      throw new Error('Text proposal patches must be ordered and non-overlapping')
    }
    previousTo = candidate.to as number
    return {
      documentId,
      from: candidate.from as number,
      to: candidate.to as number,
      text: candidate.text,
    }
  })
}

function validateAiProposalMetadata(options: DomainProposalToAiProposalOptions): void {
  if (
    !['pending', 'accepted', 'rejected', 'stale', 'committed', 'undone'].includes(options.status)
  ) {
    throw new Error('Text proposal status is invalid')
  }
  for (const [name, value] of [
    ['createdAt', options.createdAt],
    ['updatedAt', options.updatedAt],
    ['committedRevision', options.committedRevision],
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`Text proposal ${name} must be a non-negative integer`)
    }
  }
}

function cloneEvidence(evidence: DomainProposalEvidence): DomainProposalEvidence {
  return { ...evidence }
}

function cloneDomainProposal(proposal: DomainProposal): DomainProposal {
  return {
    ...proposal,
    target: { ...proposal.target },
    patch: cloneJsonValue(proposal.patch),
    ...(proposal.evidence === undefined
      ? {}
      : { evidence: proposal.evidence.map(cloneEvidence) }),
  }
}

function cloneJsonValue<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('Domain proposal patch is not serializable')
  return JSON.parse(serialized) as T
}

function canonicalize(value: unknown): unknown {
  if (value === undefined || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => canonicalize(item) ?? null)

  const record = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    const item = canonicalize(record[key])
    if (item !== undefined) sorted[key] = item
  }
  return sorted
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
