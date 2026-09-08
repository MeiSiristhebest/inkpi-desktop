import { calculateDomainChangeSetChecksum, type DomainChange, type DomainChangeSet } from '@inkpi/protocol'

export interface CreateDomainChangeSetInput {
  id: string
  workspaceId: string
  sourceDeviceId: string
  baseRevision: number
  changes: DomainChange[]
  createdAt: number
}

export function createDomainChangeSet(input: CreateDomainChangeSetInput): DomainChangeSet {
  if (!Number.isInteger(input.baseRevision) || input.baseRevision < 0) {
    throw new RangeError('Domain change base revision must be a non-negative integer')
  }
  const unsigned = {
    id: input.id,
    workspaceId: input.workspaceId,
    sourceDeviceId: input.sourceDeviceId,
    baseRevision: input.baseRevision,
    revision: input.baseRevision + 1,
    changes: input.changes.map((change) => ({ ...change })),
    createdAt: input.createdAt,
  }
  return { ...unsigned, checksum: calculateDomainChangeSetChecksum(unsigned) }
}
