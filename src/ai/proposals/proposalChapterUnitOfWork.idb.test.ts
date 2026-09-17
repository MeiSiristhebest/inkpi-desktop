import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../db/indexedDB'
import { ProposalChapterUnitOfWork } from './proposalChapterUnitOfWork'
import { ProposalConflictError } from './proposalLedger'
import type { AiProposal } from './proposalLedger'
import type { ChapterRecord } from '../../services/defaultChapterMutationService'

describe('ProposalChapterUnitOfWork - Real IndexedDB Atomic Rollback', () => {
  const chapterId = 'chapter-real-idb-1'
  const proposalId = 'proposal-real-idb-1'
  const workspaceId = 'ws-real-idb'

  beforeEach(async () => {
    vi.restoreAllMocks()
    await db.delete('chapters', chapterId)
    await db.delete('aiProposals', proposalId)
  })

  it('atomically rolls back all IndexedDB changes when conflict occurs', async () => {
    const initialChapter: ChapterRecord = {
      id: chapterId,
      projectId: workspaceId,
      volumeId: 'vol-1',
      title: 'Real IDB Chapter',
      content: '<p>Initial Content</p>',
      wordCount: 15,
      order: 0,
      status: 'draft',
      createdAt: 1000,
      updatedAt: 1000,
      revision: 3,
    }

    const initialProposal: AiProposal = {
      id: proposalId,
      documentId: chapterId,
      workspaceId,
      status: 'accepted',
      patches: [{ from: 0, to: 7, text: '<p>Modified' }],
      inversePatches: [{ from: 0, to: 11, text: '<p>Initial' }],
      baseRevision: 3,
      createdAt: 1000,
      updatedAt: 1000,
    }

    await db.put('chapters', initialChapter)
    await db.put('aiProposals', initialProposal)

    await expect(
      ProposalChapterUnitOfWork.commitProposalWithChapter({
        workspaceId,
        chapterId,
        proposalId,
        expectedRevision: 99,
        nextContent: '<p>Modified Content</p>',
      }),
    ).rejects.toThrow(ProposalConflictError)

    const chapterAfter = await db.get('chapters', chapterId)
    expect(chapterAfter?.revision).toBe(3)
    expect(chapterAfter?.content).toBe('<p>Initial Content</p>')

    const proposalAfter = await db.get('aiProposals', proposalId)
    expect(proposalAfter?.status).toBe('accepted')
    expect(proposalAfter?.committedRevision).toBeUndefined()
  })

  it('rolls back completely when transaction aborts due to runtime failure midway', async () => {
    const initialChapter: ChapterRecord = {
      id: chapterId,
      projectId: workspaceId,
      volumeId: 'vol-1',
      title: 'Real IDB Chapter 2',
      content: '<p>Before Abort</p>',
      wordCount: 12,
      order: 0,
      status: 'draft',
      createdAt: 1000,
      updatedAt: 1000,
      revision: 5,
    }

    const initialProposal: AiProposal = {
      id: proposalId,
      documentId: chapterId,
      workspaceId,
      status: 'accepted',
      patches: [{ from: 0, to: 5, text: '<p>After' }],
      inversePatches: [{ from: 0, to: 5, text: '<p>Before' }],
      baseRevision: 5,
      createdAt: 1000,
      updatedAt: 1000,
    }

    await db.put('chapters', initialChapter)
    await db.put('aiProposals', initialProposal)

    const originalRunTx = db.runTransaction.bind(db)
    vi.spyOn(db, 'runTransaction').mockImplementation(async (stores, op) => {
      return originalRunTx(stores, (tx, fail) => {
        op(tx, fail)
        fail(new Error('Simulated mid-transaction disk failure'))
      })
    })

    await expect(
      ProposalChapterUnitOfWork.commitProposalWithChapter({
        workspaceId,
        chapterId,
        proposalId,
        expectedRevision: 5,
        nextContent: '<p>After Abort</p>',
      }),
    ).rejects.toThrow(/Simulated mid-transaction disk failure|AbortError/)

    const chapterAfter = await db.get('chapters', chapterId)
    expect(chapterAfter?.revision).toBe(5)
    expect(chapterAfter?.content).toBe('<p>Before Abort</p>')

    const proposalAfter = await db.get('aiProposals', proposalId)
    expect(proposalAfter?.status).toBe('accepted')
  })
})
