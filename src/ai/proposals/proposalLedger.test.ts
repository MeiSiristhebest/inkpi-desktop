import { describe, expect, it } from 'vitest'
import {
  ProposalConflictError,
  ProposalLedger,
  proposalFromContinuation,
  proposalFromPatch,
} from './index'

describe('AI proposal to commit flow', () => {
  it('requires explicit acceptance and commits only against the base revision', async () => {
    const ledger = new ProposalLedger()
    const proposal = proposalFromContinuation(
      {
        taskId: 'task-1',
        kind: 'creative.continue',
        status: 'completed',
        output: { format: 'text', text: '续写' },
      },
      { id: 'proposal-1', documentId: 'chapter-1', baseRevision: 4, at: 8 },
    )
    ledger.create(proposal)
    await expect(ledger.commit('proposal-1', 4, () => undefined)).rejects.toThrow(/must be accepted/)
    ledger.accept('proposal-1')
    const applied: unknown[] = []
    const receipt = await ledger.commit('proposal-1', 4, (patches, revision) => {
      applied.push(patches, revision)
    })
    expect(receipt.revision).toBe(5)
    expect(applied[1]).toBe(5)
    expect(ledger.get('proposal-1')?.status).toBe('committed')
  })

  it('marks a proposal stale on an optimistic concurrency conflict', async () => {
    const ledger = new ProposalLedger()
    ledger.create(
      proposalFromPatch(
        {
          taskId: 'task-2',
          kind: 'creative.rewrite',
          status: 'completed',
          output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
        },
        { id: 'proposal-2', documentId: 'chapter-1', baseRevision: 2 },
      ),
    )
    ledger.accept('proposal-2')
    await expect(ledger.commit('proposal-2', 3, () => undefined)).rejects.toBeInstanceOf(ProposalConflictError)
    expect(ledger.get('proposal-2')?.status).toBe('stale')
  })

  it('does not invent a source hash from the proposed patch', async () => {
    const ledger = new ProposalLedger()
    ledger.create(
      proposalFromPatch(
        {
          taskId: 'task-3',
          kind: 'creative.rewrite',
          status: 'completed',
          output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
        },
        { id: 'proposal-3', documentId: 'chapter-1', baseRevision: 0 },
      ),
    )
    ledger.accept('proposal-3')
    await expect(ledger.commit('proposal-3', 0, () => undefined, 'current-document-hash')).resolves.toMatchObject({
      proposalId: 'proposal-3',
    })
  })

  it('supports modifying and rebasing a proposal without hashing its replacement text', () => {
    const ledger = new ProposalLedger()
    ledger.create(
      proposalFromPatch(
        {
          taskId: 'task-4',
          kind: 'creative.rewrite',
          status: 'completed',
          output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
        },
        { id: 'proposal-4', documentId: 'chapter-1', baseRevision: 1, sourceHash: 'source-1' },
      ),
    )
    ledger.modify('proposal-4', { patches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '新' }] })
    expect(ledger.get('proposal-4')?.sourceHash).toBe('source-1')
    ledger.rebase('proposal-4', 2, undefined, 'source-2')
    expect(ledger.get('proposal-4')).toMatchObject({ baseRevision: 2, sourceHash: 'source-2', status: 'pending' })
  })
})
