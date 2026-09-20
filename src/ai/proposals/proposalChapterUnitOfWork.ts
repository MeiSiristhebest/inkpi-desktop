import { db } from '../../db/indexedDB'
import type { ChapterRecord } from '../../types'
import {
  type AiProposal,
  type CommitReceipt,
  type TextPatch,
  ProposalConflictError,
} from './proposalLedger'
import { createDomainChangeSet } from '../../domain/sync/domainChangeSet'
import { domainChangeEvents } from '../../ports/domainChangeEvents'
import { chapterSaveEvents } from '../../ports/chapterSaveEvents'
import { proposalStateEvents, type ProposalEventScope } from '../../ports/proposalStateEvents'
import { draftJournal } from '../../services/draftJournal'
import { indexedDbDailyStatsRepository } from '../../adapters/indexedDbDailyStatsRepository'

export interface AtomicCommitProposalInput {
  workspaceId: string
  chapterId: string
  proposalId: string
  expectedRevision: number
  nextContent: string
  inversePatches?: TextPatch[]
  now?: number
  sourceHash?: string
  fallbackChapter?: Partial<ChapterRecord>
  eventScope?: ProposalEventScope
}

export interface AtomicUndoProposalInput {
  workspaceId: string
  chapterId: string
  proposalId: string
  expectedRevision: number
  restoredContent: string
  now?: number
  fallbackChapter?: Partial<ChapterRecord>
  eventScope?: ProposalEventScope
}

const OPERATION_LOCK_PREFIX = 'op-lock:'

function countWords(content: string): number {
  if (!content) return 0
  const text = content.replace(/<[^>]+>/g, ' ').trim()
  return text ? text.length : 0
}

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val))
}

export class ProposalChapterUnitOfWork {
  /**
   * Executes an atomic commit of both the chapter and proposal in a single IndexedDB transaction
   * spanning ["chapters", "aiProposals", "domainChangeSets"].
   * If any precondition or write fails, the entire transaction aborts with zero partial state.
   */
  static async commitProposalWithChapter(input: AtomicCommitProposalInput): Promise<CommitReceipt> {
    const {
      workspaceId,
      chapterId,
      proposalId,
      expectedRevision,
      nextContent,
      inversePatches,
      now = Date.now(),
      sourceHash,
      eventScope,
    } = input

    let committedChapter!: ChapterRecord
    let committedProposal!: AiProposal
    let nextRevision = expectedRevision + 1
    let committedWorkspaceRevision = 0
    let wordDelta = 0

    await db.runTransaction(
      ['chapters', 'aiProposals', 'domainChangeSets'],
      (transaction, fail) => {
        const chapterStore = transaction.objectStore('chapters')
        const proposalStore = transaction.objectStore('aiProposals')
        const domainStore = transaction.objectStore('domainChangeSets')

        const chapterReq = chapterStore.get(chapterId)
        const proposalReq = proposalStore.get(proposalId)
        const lockReq = proposalStore.get(OPERATION_LOCK_PREFIX + proposalId)
        const domainReq = domainStore.getAll()

        let chapterLoaded = false
        let proposalLoaded = false
        let lockLoaded = false
        let domainLoaded = false

        let currentChapter: ChapterRecord | undefined
        let currentProposal: AiProposal | undefined
        let currentLock: unknown
        let allDomainChanges: any[] | undefined

        const checkReady = () => {
          if (!chapterLoaded || !proposalLoaded || !lockLoaded || !domainLoaded) return

          try {
            // 1. Validate Proposal state
            if (!currentProposal) {
              throw new Error('Proposal ' + proposalId + ' not found')
            }
            if (currentLock) {
              throw new Error('Proposal ' + proposalId + ' is locked by another operation')
            }
            if (currentProposal.status !== 'accepted') {
              throw new Error(
                'Proposal ' +
                  proposalId +
                  ' must be accepted before commit (status: ' +
                  currentProposal.status +
                  ')',
              )
            }
            if (currentProposal.baseRevision !== expectedRevision) {
              throw new ProposalConflictError(
                proposalId,
                currentProposal.baseRevision,
                expectedRevision,
              )
            }
            if (
              sourceHash !== undefined &&
              currentProposal.sourceHash !== undefined &&
              sourceHash !== currentProposal.sourceHash
            ) {
              throw new Error(
                'Proposal ' + proposalId + ' source hash does not match current document',
              )
            }

            // 2. Validate Chapter state — fail-closed: chapter MUST exist in DB
            if (!currentChapter) {
              throw new ProposalConflictError(
                proposalId,
                expectedRevision,
                -1,
                `Chapter ${chapterId} not found in database; cannot commit proposal atomically`,
              )
            }

            const chapterRev = currentChapter.revision ?? 1
            if (chapterRev !== expectedRevision) {
              throw new ProposalConflictError(proposalId, expectedRevision, chapterRev)
            }

            nextRevision = expectedRevision + 1
            const newWordCount = countWords(nextContent)
            wordDelta = newWordCount - (currentChapter.wordCount || 0)

            committedChapter = {
              ...currentChapter,
              content: nextContent,
              wordCount: newWordCount,
              revision: nextRevision,
              updatedAt: now,
            }

            committedProposal = {
              ...clone(currentProposal),
              status: 'committed',
              committedRevision: nextRevision,
              inversePatches: inversePatches?.map((p) => ({ ...p })),
              updatedAt: now,
            }

            // 3. Prepare DomainChangeSet
            const workspaceChanges = (allDomainChanges || [])
              .filter((record: any) => record.workspaceId === workspaceId)
              .sort((a: any, b: any) => a.revision - b.revision)
            const currentWorkspaceRev = workspaceChanges.at(-1)?.revision ?? 0
            committedWorkspaceRevision = currentWorkspaceRev + 1

            const sourceDeviceId =
              typeof localStorage !== 'undefined'
                ? localStorage.getItem('inkpi-device-id') || 'desktop'
                : 'desktop'

            const changeSet = createDomainChangeSet({
              id: 'chapter-' + chapterId + '-' + nextRevision + '-' + now,
              workspaceId,
              sourceDeviceId,
              baseRevision: currentWorkspaceRev,
              changes: [
                {
                  id: 'chapter-change-' + chapterId + '-' + nextRevision + '-' + now,
                  aggregateType: 'chapter',
                  aggregateId: chapterId,
                  operation: 'upsert',
                  revision: nextRevision,
                  payload: committedChapter,
                  occurredAt: now,
                },
              ],
              createdAt: now,
            })

            // 4. Perform atomic writes
            chapterStore.put(committedChapter)
            proposalStore.put(committedProposal)
            domainStore.put(changeSet)
          } catch (err) {
            fail(err)
          }
        }

        chapterReq.onsuccess = () => {
          currentChapter = chapterReq.result
          chapterLoaded = true
          checkReady()
        }
        chapterReq.onerror = () => fail(chapterReq.error)

        proposalReq.onsuccess = () => {
          currentProposal = proposalReq.result
          proposalLoaded = true
          checkReady()
        }
        proposalReq.onerror = () => fail(proposalReq.error)

        lockReq.onsuccess = () => {
          currentLock = lockReq.result
          lockLoaded = true
          checkReady()
        }
        lockReq.onerror = () => fail(lockReq.error)

        domainReq.onsuccess = () => {
          allDomainChanges = domainReq.result
          domainLoaded = true
          checkReady()
        }
        domainReq.onerror = () => fail(domainReq.error)
      },
    )

    // After atomic transaction completes successfully:
    draftJournal.clear(workspaceId, chapterId)
    chapterSaveEvents.publish(committedChapter)
    domainChangeEvents.publish(workspaceId, committedWorkspaceRevision)
    if (eventScope) {
      proposalStateEvents.publish({
        ...eventScope,
        proposalId,
        status: 'committed',
        kind: 'updated',
        updatedAt: now,
      })
    }
    if (wordDelta !== 0) {
      void indexedDbDailyStatsRepository.recordDailyWords(workspaceId, wordDelta).catch(() => {})
    }

    return {
      proposalId: committedProposal.id,
      documentId: committedProposal.documentId,
      revision: nextRevision,
      patches: committedProposal.patches.map((p) => ({ ...p })),
      inversePatches: committedProposal.inversePatches?.map((p) => ({ ...p })),
    }
  }

  /**
   * Executes an atomic undo of both the chapter and proposal in a single IndexedDB transaction
   * spanning ["chapters", "aiProposals", "domainChangeSets"].
   */
  static async undoProposalWithChapter(input: AtomicUndoProposalInput): Promise<CommitReceipt> {
    const {
      workspaceId,
      chapterId,
      proposalId,
      expectedRevision,
      restoredContent,
      now = Date.now(),
      eventScope,
    } = input

    let restoredChapter!: ChapterRecord
    let undoneProposal!: AiProposal
    let nextRevision = expectedRevision + 1
    let committedWorkspaceRevision = 0
    let wordDelta = 0

    await db.runTransaction(
      ['chapters', 'aiProposals', 'domainChangeSets'],
      (transaction, fail) => {
        const chapterStore = transaction.objectStore('chapters')
        const proposalStore = transaction.objectStore('aiProposals')
        const domainStore = transaction.objectStore('domainChangeSets')

        const chapterReq = chapterStore.get(chapterId)
        const proposalReq = proposalStore.get(proposalId)
        const lockReq = proposalStore.get(OPERATION_LOCK_PREFIX + proposalId)
        const domainReq = domainStore.getAll()

        let chapterLoaded = false
        let proposalLoaded = false
        let lockLoaded = false
        let domainLoaded = false

        let currentChapter: ChapterRecord | undefined
        let currentProposal: AiProposal | undefined
        let currentLock: unknown
        let allDomainChanges: any[] | undefined

        const checkReady = () => {
          if (!chapterLoaded || !proposalLoaded || !lockLoaded || !domainLoaded) return

          try {
            // 1. Validate Proposal state
            if (!currentProposal) {
              throw new Error('Proposal ' + proposalId + ' not found')
            }
            if (currentLock) {
              throw new Error('Proposal ' + proposalId + ' is locked by another operation')
            }
            if (currentProposal.status !== 'committed') {
              throw new Error(
                'Proposal ' +
                  proposalId +
                  ' must be committed before undo (status: ' +
                  currentProposal.status +
                  ')',
              )
            }

            // 2. Validate Chapter state — fail-closed: chapter MUST exist in DB
            if (!currentChapter) {
              throw new ProposalConflictError(
                proposalId,
                expectedRevision,
                -1,
                `Chapter ${chapterId} not found in database; cannot undo proposal atomically`,
              )
            }

            const chapterRev = currentChapter.revision ?? 1
            if (chapterRev !== expectedRevision) {
              throw new ProposalConflictError(proposalId, expectedRevision, chapterRev)
            }

            nextRevision = expectedRevision + 1
            const newWordCount = countWords(restoredContent)
            wordDelta = newWordCount - (currentChapter.wordCount || 0)

            restoredChapter = {
              ...currentChapter,
              content: restoredContent,
              wordCount: newWordCount,
              revision: nextRevision,
              updatedAt: now,
            }

            undoneProposal = {
              ...clone(currentProposal),
              status: 'undone',
              updatedAt: now,
            }

            // 3. Prepare DomainChangeSet
            const workspaceChanges = (allDomainChanges || [])
              .filter((record: any) => record.workspaceId === workspaceId)
              .sort((a: any, b: any) => a.revision - b.revision)
            const currentWorkspaceRev = workspaceChanges.at(-1)?.revision ?? 0
            committedWorkspaceRevision = currentWorkspaceRev + 1

            const sourceDeviceId =
              typeof localStorage !== 'undefined'
                ? localStorage.getItem('inkpi-device-id') || 'desktop'
                : 'desktop'

            const changeSet = createDomainChangeSet({
              id: 'chapter-' + chapterId + '-' + nextRevision + '-' + now,
              workspaceId,
              sourceDeviceId,
              baseRevision: currentWorkspaceRev,
              changes: [
                {
                  id: 'chapter-change-' + chapterId + '-' + nextRevision + '-' + now,
                  aggregateType: 'chapter',
                  aggregateId: chapterId,
                  operation: 'upsert',
                  revision: nextRevision,
                  payload: restoredChapter,
                  occurredAt: now,
                },
              ],
              createdAt: now,
            })

            // 4. Perform atomic writes
            chapterStore.put(restoredChapter)
            proposalStore.put(undoneProposal)
            domainStore.put(changeSet)
          } catch (err) {
            fail(err)
          }
        }

        chapterReq.onsuccess = () => {
          currentChapter = chapterReq.result
          chapterLoaded = true
          checkReady()
        }
        chapterReq.onerror = () => fail(chapterReq.error)

        proposalReq.onsuccess = () => {
          currentProposal = proposalReq.result
          proposalLoaded = true
          checkReady()
        }
        proposalReq.onerror = () => fail(proposalReq.error)

        lockReq.onsuccess = () => {
          currentLock = lockReq.result
          lockLoaded = true
          checkReady()
        }
        lockReq.onerror = () => fail(lockReq.error)

        domainReq.onsuccess = () => {
          allDomainChanges = domainReq.result
          domainLoaded = true
          checkReady()
        }
        domainReq.onerror = () => fail(domainReq.error)
      },
    )

    // After atomic transaction completes successfully:
    draftJournal.clear(workspaceId, chapterId)
    chapterSaveEvents.publish(restoredChapter)
    domainChangeEvents.publish(workspaceId, committedWorkspaceRevision)
    if (eventScope) {
      proposalStateEvents.publish({
        ...eventScope,
        proposalId,
        status: 'undone',
        kind: 'updated',
        updatedAt: now,
      })
    }
    if (wordDelta !== 0) {
      void indexedDbDailyStatsRepository.recordDailyWords(workspaceId, wordDelta).catch(() => {})
    }

    return {
      proposalId: undoneProposal.id,
      documentId: undoneProposal.documentId,
      revision: nextRevision,
      patches: undoneProposal.patches.map((p) => ({ ...p })),
      inversePatches: undoneProposal.inversePatches?.map((p) => ({ ...p })),
    }
  }
}
