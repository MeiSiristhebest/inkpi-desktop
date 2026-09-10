import { describe, expect, it } from 'vitest'
import { validateDomainProposal } from './domainProposal'

describe('Desktop DomainProposal protocol boundary', () => {
  it('uses the shared validator for evidence and mutation shape', () => {
    expect(() =>
      validateDomainProposal({
        id: 'proposal-1',
        taskId: 'task-1',
        baseRevision: 4,
        target: { type: 'entity', id: 'entity-1' },
        operation: 'update',
        patch: { name: '主角' },
        evidence: {}
      } as never)
    ).toThrow('Domain proposal evidence must be an array')

    expect(() =>
      validateDomainProposal({
        id: 'proposal-1',
        taskId: 'task-1',
        baseRevision: 4,
        target: { type: 'entity', id: 'entity-1' },
        operation: 'update',
        patch: { name: '主角' },
        evidence: [{ documentId: 'chapter-1', semanticFrom: 0, semanticTo: 2 }]
      })
    ).not.toThrow()
  })
})
