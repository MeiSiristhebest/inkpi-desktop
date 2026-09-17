import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProposalConflictError } from './proposalLedger'

// ---------------------------------------------------------------------------
// Mock all side-effects before importing the module under test
// ---------------------------------------------------------------------------

// Store registry for the current test
let mockStores: Record<string, Record<string, unknown>> = {}

vi.mock('../../db/indexedDB', () => {
  const makeRequest = (getResult: () => unknown) => {
    const req: {
      result: unknown
      error: unknown
      onsuccess?: (e?: unknown) => void
      onerror?: (e?: unknown) => void
    } = { result: undefined, error: null }
    // Fire async so all requests are registered before any callback fires
    Promise.resolve().then(() => {
      req.result = getResult()
      req.onsuccess?.()
    })
    return req
  }

  const runTransaction = (
    storeNames: string[],
    callback: (
      tx: {
        objectStore: (name: string) => {
          get: (key: string) => unknown
          getAll: () => unknown
          put: (value: unknown) => unknown
          delete: (key: string) => unknown
        }
      },
      fail: (e: unknown) => void,
    ) => void,
  ) =>
    new Promise<void>((resolve, reject) => {
      const fail = (e: unknown) => reject(e instanceof Error ? e : new Error(String(e)))
      const tx = {
        objectStore: (name: string) => ({
          get: (key: string) => makeRequest(() => mockStores[name]?.[key]),
          getAll: () => makeRequest(() => Object.values(mockStores[name] ?? {})),
          put: (value: unknown) => {
            if (!mockStores[name]) mockStores[name] = {}
            const record = value as Record<string, unknown>
            mockStores[name][String(record.id ?? record.proposalId ?? Object.keys(mockStores[name]).length)] = value
          },
          delete: (key: string) => {
            delete mockStores[name]?.[key]
          },
        }),
      }
      try {
        callback(tx, fail)
      } catch (e) {
        fail(e)
        return
      }
      // Resolve after all the micro-task onsuccess handlers have fired
      Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => resolve())
    })

  return { db: { runTransaction } }
})

vi.mock('../../services/draftJournal', () => ({ draftJournal: { clear: vi.fn() } }))
vi.mock('../../ports/chapterSaveEvents', () => ({ chapterSaveEvents: { publish: vi.fn() } }))
vi.mock('../../ports/proposalStateEvents', () => ({ proposalStateEvents: { publish: vi.fn() } }))
vi.mock('../../adapters/indexedDbDailyStatsRepository', () => ({
  indexedDbDailyStatsRepository: { recordDailyWords: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('../../ports/domainChangeEvents', () => ({
  domainChangeEvents: { publish: vi.fn() },
}))

// Import AFTER mocks are established
const { ProposalChapterUnitOfWork } = await import('./proposalChapterUnitOfWork')
const { domainChangeEvents } = await import('../../ports/domainChangeEvents')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProposal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'proposal-1',
    documentId: 'chapter-1',
    workspaceId: 'ws-1',
    status: 'accepted',
    patches: [],
    inversePatches: [],
    baseRevision: 5,
    sourceHash: undefined,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

function makeChapter(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'chapter-1',
    projectId: 'ws-1',
    volumeId: 'vol-1',
    title: 'Chapter 1',
    content: '<p>Original</p>',
    wordCount: 8,
    order: 0,
    status: 'draft',
    createdAt: 1000,
    updatedAt: 1000,
    revision: 5,
    ...overrides,
  }
}

describe('ProposalChapterUnitOfWork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStores = {}
  })

  it('commit: fail-closed when chapter is missing from DB', async () => {
    mockStores = {
      chapters: {},
      aiProposals: { 'proposal-1': makeProposal() },
      domainChangeSets: {},
    }

    await expect(
      ProposalChapterUnitOfWork.commitProposalWithChapter({
        workspaceId: 'ws-1',
        chapterId: 'chapter-1',
        proposalId: 'proposal-1',
        expectedRevision: 5,
        nextContent: '<p>Updated</p>',
      }),
    ).rejects.toBeInstanceOf(ProposalConflictError)
  })

  it('commit: fail on CAS mismatch (chapter revision differs from expected)', async () => {
    mockStores = {
      chapters: { 'chapter-1': makeChapter({ revision: 99 }) },
      aiProposals: { 'proposal-1': makeProposal() },
      domainChangeSets: {},
    }

    await expect(
      ProposalChapterUnitOfWork.commitProposalWithChapter({
        workspaceId: 'ws-1',
        chapterId: 'chapter-1',
        proposalId: 'proposal-1',
        expectedRevision: 5,
        nextContent: '<p>Updated</p>',
      }),
    ).rejects.toBeInstanceOf(ProposalConflictError)
  })

  it('commit: happy path updates chapter in DB, sets proposal status to committed, and publishes an incremental revision', async () => {
    mockStores = {
      chapters: { 'chapter-1': makeChapter() },
      aiProposals: { 'proposal-1': makeProposal() },
      domainChangeSets: {},
    }

    const receipt = await ProposalChapterUnitOfWork.commitProposalWithChapter({
      workspaceId: 'ws-1',
      chapterId: 'chapter-1',
      proposalId: 'proposal-1',
      expectedRevision: 5,
      nextContent: '<p>New content</p>',
    })

    expect(receipt.revision).toBe(6)
    expect(mockStores.chapters['chapter-1']).toMatchObject({ revision: 6, content: '<p>New content</p>' })
    expect(mockStores.aiProposals['proposal-1']).toMatchObject({ status: 'committed' })

    const publishSpy = domainChangeEvents.publish as ReturnType<typeof vi.fn>
    expect(publishSpy).toHaveBeenCalledTimes(1)
    const publishedRev = publishSpy.mock.calls[0][1]
    expect(publishedRev).toBeGreaterThan(0)
    expect(publishedRev).toBeLessThan(1_000_000_000) // must not be a timestamp
    expect(Number.isInteger(publishedRev)).toBe(true)
  })

  it('undo: happy path restores chapter, sets proposal status to undone, publishes incremental revision', async () => {
    mockStores = {
      chapters: { 'chapter-1': makeChapter({ revision: 6 }) },
      aiProposals: { 'proposal-1': makeProposal({ status: 'committed', baseRevision: 5, committedRevision: 6 }) },
      domainChangeSets: {},
    }

    const receipt = await ProposalChapterUnitOfWork.undoProposalWithChapter({
      workspaceId: 'ws-1',
      chapterId: 'chapter-1',
      proposalId: 'proposal-1',
      expectedRevision: 6,
      restoredContent: '<p>Original</p>',
    })

    expect(receipt.revision).toBe(7)
    expect(mockStores.chapters['chapter-1']).toMatchObject({ revision: 7, content: '<p>Original</p>' })
    expect(mockStores.aiProposals['proposal-1']).toMatchObject({ status: 'undone' })

    const publishSpy = domainChangeEvents.publish as ReturnType<typeof vi.fn>
    expect(publishSpy).toHaveBeenCalledTimes(1)
    const publishedRev = publishSpy.mock.calls[0][1]
    expect(publishedRev).toBeGreaterThan(0)
    expect(publishedRev).toBeLessThan(1_000_000_000)
    expect(Number.isInteger(publishedRev)).toBe(true)
  })

  it('undo: fail-closed when chapter is missing from DB', async () => {
    mockStores = {
      chapters: {},
      aiProposals: { 'proposal-1': makeProposal({ status: 'committed', committedRevision: 6 }) },
      domainChangeSets: {},
    }

    await expect(
      ProposalChapterUnitOfWork.undoProposalWithChapter({
        workspaceId: 'ws-1',
        chapterId: 'chapter-1',
        proposalId: 'proposal-1',
        expectedRevision: 6,
        restoredContent: '<p>Original</p>',
      }),
    ).rejects.toBeInstanceOf(ProposalConflictError)
  })
})