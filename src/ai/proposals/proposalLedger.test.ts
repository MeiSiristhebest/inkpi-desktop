import { describe, expect, it } from 'vitest'
import { db } from '../../db/indexedDB'
import {
  IndexedDbProposalStore,
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

  it('supports reject, modify, accept, commit, undo, and undo CAS conflict boundaries', async () => {
    const ledger = new ProposalLedger()
    const makeProposal = (id: string) => proposalFromPatch(
      {
        taskId: `task-${id}`,
        kind: 'creative.rewrite',
        status: 'completed',
        output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
      },
      { id, documentId: 'chapter-1', baseRevision: 1 },
    )

    ledger.create(makeProposal('rejected'))
    expect(ledger.reject('rejected').status).toBe('rejected')
    expect(() => ledger.accept('rejected')).toThrow(/not pending/)

    ledger.create(makeProposal('undoable'))
    expect(ledger.modify('undoable', {
      patches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '修改后' }],
      explanation: '更准确',
    })).toMatchObject({ status: 'pending', explanation: '更准确' })
    ledger.accept('undoable')
    const applied: Array<{ text: string; revision: number }> = []
    await expect(ledger.commit('undoable', 1, (patches, revision) => {
      applied.push({ text: patches[0].text, revision })
      return { inversePatches: [{ documentId: 'chapter-1', from: 0, to: 3, text: '原文' }] }
    })).resolves.toMatchObject({ revision: 2 })
    await expect(ledger.undo('undoable', 2, (patches, revision) => {
      applied.push({ text: patches[0].text, revision })
    })).resolves.toMatchObject({ revision: 3 })
    expect(applied).toEqual([{ text: '修改后', revision: 2 }, { text: '原文', revision: 3 }])
    expect(ledger.get('undoable')?.status).toBe('undone')

    ledger.create(makeProposal('undo-conflict'))
    ledger.accept('undo-conflict')
    await ledger.commit('undo-conflict', 1, () => ({
      inversePatches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '原' }],
    }))
    await expect(ledger.undo('undo-conflict', 3, () => undefined)).rejects.toBeInstanceOf(ProposalConflictError)
    expect(ledger.get('undo-conflict')?.status).toBe('stale')
  })

  it('rehydrates proposal review and CAS state from IndexedDB', async () => {
    const proposalId = 'indexed-db-proposal-ledger-test'
    await db.delete('aiProposals', proposalId)
    try {
      const proposal = proposalFromPatch(
        {
          taskId: 'indexed-db-proposal-task',
          kind: 'creative.rewrite',
          status: 'completed',
          output: { format: 'patch', patch: { from: 0, to: 1, text: '改' } },
        },
        { id: proposalId, documentId: 'chapter-1', baseRevision: 1 },
      )
      const first = new ProposalLedger({ store: new IndexedDbProposalStore() })
      await first.ready
      first.create(proposal)
      await first.flush()

      const second = new ProposalLedger({ store: new IndexedDbProposalStore() })
      await second.ready
      expect(second.get(proposalId)?.status).toBe('pending')
      second.accept(proposalId)
      await second.commit(proposalId, 1, () => ({
        inversePatches: [{ documentId: 'chapter-1', from: 0, to: 1, text: '原' }],
      }))
      await second.flush()

      const committed = new ProposalLedger({ store: new IndexedDbProposalStore() })
      await committed.ready
      expect(committed.get(proposalId)).toMatchObject({ status: 'committed', committedRevision: 2 })
      await committed.undo(proposalId, 2, async () => undefined)
      await committed.flush()

      const rehydrated = new ProposalLedger({ store: new IndexedDbProposalStore() })
      await rehydrated.ready
      expect(rehydrated.get(proposalId)?.status).toBe('undone')
    } finally {
      await db.delete('aiProposals', proposalId)
    }
  })
})
