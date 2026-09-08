export interface DomainProposalEvidence {
  documentId?: string
  blockId?: string
  excerpt?: string
  semanticFrom?: number
  semanticTo?: number
}

/** A reviewable creative-domain mutation; it is not applied by a task handler. */
export interface DomainProposal {
  id: string
  taskId: string
  baseRevision: number
  sourceHash?: string
  target: {
    type: string
    id: string
  }
  operation: 'create' | 'update' | 'delete'
  patch?: unknown
  evidence?: DomainProposalEvidence[]
  reason?: string
}

export function validateDomainProposal(proposal: DomainProposal): void {
  if (!proposal.id.trim() || !proposal.taskId.trim()) {
    throw new Error('Domain proposal identifiers must not be empty')
  }
  if (!Number.isInteger(proposal.baseRevision) || proposal.baseRevision < 0) {
    throw new Error('Domain proposal base revision must be a non-negative integer')
  }
  if (!proposal.target.type.trim() || !proposal.target.id.trim()) {
    throw new Error('Domain proposal target must identify a domain object')
  }
  if (proposal.operation !== 'delete' && proposal.patch === undefined) {
    throw new Error('Create and update proposals require a patch')
  }
}
