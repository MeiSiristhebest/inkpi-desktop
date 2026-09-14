import { describe, expect, it } from 'vitest'
import {
  domainProposalRecordToProjectionState,
  projectionStateToDomainProposalRecord,
} from './daemonDomainSyncRemote'
import type { DomainProposalRecord } from '../ai/proposals/domainProposalLedger'

describe('daemon generic DomainProposal boundary', () => {
  it('projects an opaque local proposal without applying it or losing review state', () => {
    const proposal: DomainProposalRecord = {
      id: 'domain-proposal-1',
      taskId: 'task-1',
      baseRevision: 4,
      target: { type: 'entity', id: 'hero' },
      operation: 'update',
      patch: { name: '新名字', nested: { keep: true } },
      status: 'accepted',
      createdAt: 10,
      updatedAt: 11,
      inversePatch: { name: '旧名字' },
      committedRevision: undefined,
    }

    const projected = domainProposalRecordToProjectionState(proposal)
    expect(projected).toMatchObject({
      id: proposal.id,
      status: 'accepted',
      target: proposal.target,
      patch: proposal.patch,
      inversePatch: proposal.inversePatch,
      updatedAt: 11,
    })

    const restored = projectionStateToDomainProposalRecord(projected)
    expect(restored).toMatchObject({
      id: proposal.id,
      taskId: proposal.taskId,
      status: proposal.status,
      patch: proposal.patch,
      inversePatch: proposal.inversePatch,
    })
  })
})
