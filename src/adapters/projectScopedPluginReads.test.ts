import { describe, expect, it } from 'vitest'
import type { CardRecord, TableRowRecord } from '../types'
import { indexedDbCardRecordRepository } from './indexedDbCardRecordRepository'
import { indexedDbClueWeaverRepository } from './indexedDbClueWeaverRepository'
import { indexedDbTableRecordRepository } from './indexedDbTableRecordRepository'
import { DB_NAME, db, type StoreName } from '../db/indexedDB'
import type { ClueCognitionRecord, ClueItem } from '../ports/clueWeaverRepository'

/**
 * These three plugin repositories used to clone their whole store and filter the result in JS, so
 * one author's project paid for every other project in the same store. They now read through the
 * `projectId` index, which changes what a wrong result means: a dropped row and a leaked row are
 * both visible here, and neither is visible from a full-store filter.
 */

const OWN = 'p-scope-own'
const NEIGHBOUR = 'p-scope-neighbour'

function openExistingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error(`Opening ${DB_NAME} was blocked by another connection`))
  })
}

async function putAll<T extends { id: string }>(store: StoreName, records: T[]): Promise<void> {
  await db.runTransaction([store], (transaction) => {
    for (const record of records) transaction.objectStore(store).put(record)
  })
}

async function dropAll(store: StoreName): Promise<void> {
  await db.runTransaction([store], (transaction, fail) => {
    const objectStore = transaction.objectStore(store)
    const request = objectStore.getAllKeys()
    request.onerror = () => fail(request.error)
    request.onsuccess = () => {
      for (const key of request.result) objectStore.delete(key)
    }
  })
}

function card(id: string, projectId: string, tabId: string): CardRecord {
  return { id, projectId, tabId, name: id, data: {}, createdAt: 1, updatedAt: 1 }
}

function row(id: string, projectId: string, tabId: string): TableRowRecord {
  return { id, projectId, tabId, data: {}, createdAt: 1, updatedAt: 1 }
}

function clue(id: string, projectId: string): ClueItem {
  return {
    id,
    projectId,
    title: id,
    category: 'murder',
    description: '',
    keywords: [],
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  }
}

function cognition(id: string, projectId: string, clueId: string): ClueCognitionRecord {
  return {
    id,
    projectId,
    clueId,
    characterId: 'c-1',
    characterName: '侦探',
    epistemicState: 'known',
    updatedAt: 1,
  }
}

function storedClue(id: string, projectId: string) {
  return { id, projectId, recordType: 'clue' as const, payload: clue(id, projectId) }
}

function storedCognition(id: string, projectId: string, clueId: string) {
  const record = cognition(id, projectId, clueId)
  return { id, projectId, recordType: 'cognition' as const, payload: record }
}

describe('project-scoped plugin reads', () => {
  it('every store the three adapters read is indexed by project id', async () => {
    // getByIndex silently degrades to a whole-store clone plus a JS filter when an index is
    // missing, so the assertions below would still pass on a library that never gained the index.
    // This is the structural half of the gate.
    //
    // Only the wrapper knows the upgrade schema, so the first access has to go through it: opening
    // the raw database on a fresh test file would create an empty library with no stores at all.
    await db.getAll('cardRecords')

    const raw = await openExistingDatabase()
    try {
      for (const store of ['cardRecords', 'tableRows', 'clueMatrices'] as const) {
        const objectStore = raw.transaction(store, 'readonly').objectStore(store)
        expect(Array.from(objectStore.indexNames)).toContain('projectId')
      }
    } finally {
      raw.close()
    }
  })

  it('returns only the requested project and tab for cards and table rows', async () => {
    await dropAll('cardRecords')
    await dropAll('tableRows')
    // The neighbour deliberately reuses both tab ids: a read that filtered on tabId alone, or that
    // leaked across projects, would still return three rows and look healthy.
    await putAll('cardRecords', [
      card('own-main-1', OWN, 'char-main'),
      card('own-main-2', OWN, 'char-main'),
      card('own-side-1', OWN, 'char-side'),
      card('neighbour-main-1', NEIGHBOUR, 'char-main'),
      card('neighbour-side-1', NEIGHBOUR, 'char-side'),
    ])
    await putAll('tableRows', [
      row('own-ideas-1', OWN, 'ideas'),
      row('own-progress-1', OWN, 'progress'),
      row('neighbour-ideas-1', NEIGHBOUR, 'ideas'),
      row('neighbour-missing-1', NEIGHBOUR, 'foreshadow'),
    ])

    const ids = (records: Array<{ id: string }>) => records.map((record) => record.id).sort()

    expect(ids(await indexedDbCardRecordRepository.getCards(OWN, 'char-main'))).toEqual([
      'own-main-1',
      'own-main-2',
    ])
    expect(ids(await indexedDbCardRecordRepository.getCards(OWN, 'char-side'))).toEqual([
      'own-side-1',
    ])
    expect(ids(await indexedDbCardRecordRepository.getCards(NEIGHBOUR, 'char-main'))).toEqual([
      'neighbour-main-1',
    ])
    expect(
      ids(await indexedDbCardRecordRepository.getCards('p-scope-absent', 'char-main')),
    ).toEqual([])

    expect(ids(await indexedDbTableRecordRepository.getRows(OWN, 'ideas'))).toEqual(['own-ideas-1'])
    expect(ids(await indexedDbTableRecordRepository.getRows(OWN, 'progress'))).toEqual([
      'own-progress-1',
    ])
    expect(ids(await indexedDbTableRecordRepository.getRows(NEIGHBOUR, 'foreshadow'))).toEqual([
      'neighbour-missing-1',
    ])

    // Nothing was lost by indexing: the per-project reads cover every seeded row exactly once.
    const allCards = await db.getAll<CardRecord>('cardRecords')
    const allRows = await db.getAll<TableRowRecord>('tableRows')
    expect(allCards).toHaveLength(5)
    expect(allRows).toHaveLength(4)
  })

  it('separates clues from cognitions without crossing projects', async () => {
    await dropAll('clueMatrices')
    // The store holds one envelope shape for both kinds, discriminated by recordType, so seeding
    // must mirror saveClue/saveCognition rather than writing a bare ClueItem.
    await putAll('clueMatrices', [
      storedClue('own-clue-1', OWN),
      storedClue('own-clue-2', OWN),
      storedClue('neighbour-clue-1', NEIGHBOUR),
      storedCognition('own-cognition-1', OWN, 'own-clue-1'),
      storedCognition('neighbour-cognition-1', NEIGHBOUR, 'neighbour-clue-1'),
    ])

    const ownClues = await indexedDbClueWeaverRepository.getAllClues(OWN)
    const ownCognitions = await indexedDbClueWeaverRepository.getAllCognitions(OWN)

    expect(ownClues.map((item) => item.id).sort()).toEqual(['own-clue-1', 'own-clue-2'])
    expect(ownCognitions.map((item) => item.id)).toEqual(['own-cognition-1'])
    // A stored record carries both kinds in one store, so the recordType filter has to hold while
    // the project filter is applied through the index rather than after it.
    expect(await indexedDbClueWeaverRepository.getAllClues(NEIGHBOUR)).toEqual([
      expect.objectContaining({ id: 'neighbour-clue-1' }),
    ])
    expect(
      (await indexedDbClueWeaverRepository.getAllCognitions(NEIGHBOUR)).map((item) => item.id),
    ).toEqual(['neighbour-cognition-1'])
    expect(await indexedDbClueWeaverRepository.getAllClues('p-scope-absent')).toEqual([])
    expect(await indexedDbClueWeaverRepository.getAllCognitions('p-scope-absent')).toEqual([])

    expect(await db.getAll('clueMatrices')).toHaveLength(5)
  })
})
