import { describe, expect, it } from 'vitest'
import type { AiProposal } from './proposalLedger'
import {
  aiProposalToDomainProposal,
  deserializeDomainProposal,
  domainProposalToAiProposal,
  serializeDomainProposal,
  validateDomainProposal,
} from './domainProposal'

const textProposal: AiProposal = {
  id: 'proposal-1',
  taskId: 'task-1',
  documentId: 'chapter-1',
  baseRevision: 4,
  patches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '改' }],
  explanation: '保留作者语气',
  status: 'pending',
  createdAt: 10,
  sourceHash: 'document-hash-4',
}

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

  it('round-trips a text proposal through the canonical DomainProposal JSON boundary', () => {
    const domainProposal = aiProposalToDomainProposal(textProposal, [
      { documentId: 'chapter-1', semanticFrom: 0, semanticTo: 1, excerpt: '原文' },
    ])
    const serialized = serializeDomainProposal(domainProposal)
    const decoded = deserializeDomainProposal(serialized)

    expect(serializeDomainProposal(decoded)).toBe(serialized)
    expect(
      domainProposalToAiProposal(decoded, {
        status: textProposal.status,
        createdAt: textProposal.createdAt,
      }),
    ).toEqual(textProposal)
  })

  it('rejects malformed evidence before a DomainProposal can be serialized or restored', () => {
    const domainProposal = aiProposalToDomainProposal(textProposal)

    expect(() =>
      serializeDomainProposal({
        ...domainProposal,
        evidence: [{ semanticFrom: 3, semanticTo: 1 }],
      }),
    ).toThrow('Domain proposal evidence range at index 0 is inverted')
    expect(() =>
      deserializeDomainProposal(JSON.stringify({ ...domainProposal, evidence: [null] })),
    ).toThrow('Domain proposal evidence at index 0 must be an object')
    expect(() =>
      aiProposalToDomainProposal({
        ...textProposal,
        patches: [{ documentId: 'chapter-1', from: 2, to: 1, text: '坏' }],
      }),
    ).toThrow('Text proposal patch at index 0 is invalid')
  })
})
