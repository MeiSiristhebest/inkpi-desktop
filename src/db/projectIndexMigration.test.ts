import { describe, expect, it } from 'vitest'
import type { DomainChangeSet } from '@inkpi/protocol'
import type { ChapterRecord, FormDataRecord } from '../types'
import { IndexedDbDomainChangeStore } from '../adapters/indexedDbDomainChangeStore'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'
import { DB_NAME, DB_VERSION, db } from './indexedDB'

/**
 * The store wrapper only created indexes for stores it created inside the same upgrade, so a
 * pre-existing library never gains a newly required index — getByIndex would quietly keep doing
 * full-store filters. Every store the project-scoped reads now depend on has to be indexed in the
 * upgrade pass, and not one row may be lost while doing it (INV-01).
 */

const LEGACY_WORKSPACE = 'p-legacy'
const OTHER_WORKSPACE = 'p-legacy-other'

function legacyChapter(projectId: string, id: string): ChapterRecord {
  return {
    id,
    projectId,
    volumeId: `${projectId}-v-01`,
    title: `旧章节 ${id}`,
    content: '寒潭惊变，青灯古寺。',
    wordCount: 12,
    order: 1,
    createdAt: 1_600_000_000_000,
    updatedAt: 1_600_000_000_000,
  }
}

function legacyFormRecord(projectId: string, id: string): FormDataRecord {
  return { id, projectId, tabId: 'notes', data: { text: id } }
}

function legacyArtifact(workspaceId: string, id: string) {
  return {
    id,
    taskId: `${id}-task`,
    kind: 'narrative.project.distill',
    type: 'creative.chapter-summary',
    version: 1,
    content: { summary: id },
    provenance: { taskId: `${id}-task` },
    createdAt: 1_600_000_000_000,
    updatedAt: 1_600_000_000_000,
    ownership: { owner: 'desktop', authoritative: true, workspaceId },
  }
}

function legacyChangeSet(projectId: string, baseRevision: number): DomainChangeSet {
  return createDomainChangeSet({
    id: `${projectId}-set-${baseRevision + 1}`,
    workspaceId: projectId,
    sourceDeviceId: 'legacy-device',
    baseRevision,
    changes: [
      {
        id: `${projectId}-change-${baseRevision + 1}`,
        aggregateType: 'chapter',
        aggregateId: `${projectId}-c-0001`,
        operation: 'upsert',
        revision: baseRevision + 1,
        occurredAt: 1_600_000_000_000 + baseRevision,
      },
    ],
    createdAt: 1_600_000_000_000 + baseRevision,
  })
}

function openRaw(
  version: number,
  onUpgrade?: (database: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => onUpgrade?.(request.result)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function removeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`${DB_NAME} deletion was blocked`))
  })
}

function indexNamesOf(database: IDBDatabase, storeName: string): string[] {
  return Array.from(database.transaction(storeName, 'readonly').objectStore(storeName).indexNames)
}

async function seedLegacyLibrary(): Promise<void> {
  // A library as an existing user would have it: stores created before the indexes existed,
  // already holding rows for two projects.
  const legacy = await openRaw(DB_VERSION - 1, (database) => {
    database.createObjectStore('chapters', { keyPath: 'id' })
    database.createObjectStore('formData', { keyPath: 'id' })
    database.createObjectStore('domainChangeSets', { keyPath: 'id' })
    database.createObjectStore('aiArtifacts', { keyPath: 'id' })
  })
  expect(indexNamesOf(legacy, 'chapters')).toEqual([])
  expect(indexNamesOf(legacy, 'formData')).toEqual([])
  expect(indexNamesOf(legacy, 'domainChangeSets')).toEqual([])
  expect(indexNamesOf(legacy, 'aiArtifacts')).toEqual([])
  await new Promise<void>((resolve, reject) => {
    const transaction = legacy.transaction(
      ['chapters', 'formData', 'domainChangeSets', 'aiArtifacts'],
      'readwrite',
    )
    const chapters = transaction.objectStore('chapters')
    chapters.put(legacyChapter(LEGACY_WORKSPACE, 'legacy-chapter-1'))
    chapters.put(legacyChapter(LEGACY_WORKSPACE, 'legacy-chapter-2'))
    chapters.put(legacyChapter(OTHER_WORKSPACE, 'legacy-other-chapter-1'))
    const forms = transaction.objectStore('formData')
    forms.put(legacyFormRecord(LEGACY_WORKSPACE, 'legacy-form-1'))
    forms.put(legacyFormRecord(OTHER_WORKSPACE, 'legacy-other-form-1'))
    const journal = transaction.objectStore('domainChangeSets')
    journal.put(legacyChangeSet(LEGACY_WORKSPACE, 0))
    journal.put(legacyChangeSet(LEGACY_WORKSPACE, 1))
    journal.put(legacyChangeSet(OTHER_WORKSPACE, 0))
    const artifacts = transaction.objectStore('aiArtifacts')
    artifacts.put(legacyArtifact(LEGACY_WORKSPACE, 'legacy-artifact-1'))
    artifacts.put(legacyArtifact(OTHER_WORKSPACE, 'legacy-artifact-2'))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  legacy.close()
}

describe('project index upgrade on an existing library', () => {
  it('indexes chapters, formData, the domain journal and artifacts that predate the indexes, keeping every row', async () => {
    await removeDatabase()
    await seedLegacyLibrary()

    // Only the wrapper knows the upgrade schema, so the first access through it is what must
    // carry the library to DB_VERSION; opening raw at that version first would upgrade the
    // version number without ever creating the indexes. The row counts double as proof that
    // the upgrade neither dropped nor duplicated anything.
    expect(await db.getAll('chapters')).toHaveLength(3)
    expect(await db.getAll('formData')).toHaveLength(2)
    expect(await db.getAll('domainChangeSets')).toHaveLength(3)
    expect(await db.getAll('aiArtifacts')).toHaveLength(2)

    const raw = await openRaw(DB_VERSION)
    try {
      expect(indexNamesOf(raw, 'chapters')).toContain('projectId')
      expect(indexNamesOf(raw, 'formData')).toContain('projectId')
      expect(indexNamesOf(raw, 'domainChangeSets')).toContain('workspaceId')
      expect(indexNamesOf(raw, 'aiArtifacts')).toEqual(
        expect.arrayContaining(['taskId', 'type', 'workspaceId']),
      )
    } finally {
      raw.close()
    }

    expect(
      (await db.getByIndex<ChapterRecord>('chapters', 'projectId', LEGACY_WORKSPACE)).map(
        (record) => record.id,
      ),
    ).toEqual(['legacy-chapter-1', 'legacy-chapter-2'])
    expect(await db.getByIndex<ChapterRecord>('chapters', 'projectId', OTHER_WORKSPACE)).toEqual([
      legacyChapter(OTHER_WORKSPACE, 'legacy-other-chapter-1'),
    ])
    expect(await db.getByIndex<FormDataRecord>('formData', 'projectId', LEGACY_WORKSPACE)).toEqual([
      legacyFormRecord(LEGACY_WORKSPACE, 'legacy-form-1'),
    ])
    expect(
      (
        await db.getByIndex<DomainChangeSet>('domainChangeSets', 'workspaceId', LEGACY_WORKSPACE)
      ).map((changeSet) => changeSet.revision),
    ).toEqual([1, 2])
    expect(
      await db.getByIndex<DomainChangeSet>('domainChangeSets', 'workspaceId', OTHER_WORKSPACE),
    ).toEqual([legacyChangeSet(OTHER_WORKSPACE, 0)])

    // The artifact workspace index is keyed on the nested ownership field, while getByIndex's
    // safety degradation filters on a top-level property of the index's name. Artifacts have no
    // such property, so an unbackfilled index would not scan the store — it would drop every AI
    // result from the Result Center.
    expect(
      (await db.getByIndex<{ id: string }>('aiArtifacts', 'workspaceId', LEGACY_WORKSPACE)).map(
        (artifact) => artifact.id,
      ),
    ).toEqual(['legacy-artifact-1'])
    expect(
      (await db.getByIndex<{ id: string }>('aiArtifacts', 'taskId', 'legacy-artifact-2-task')).map(
        (artifact) => artifact.id,
      ),
    ).toEqual(['legacy-artifact-2'])

    // The upgraded journal answers to the store's own head, so a returning author's compare-and-set
    // keeps working instead of silently starting from revision 0.
    expect(await new IndexedDbDomainChangeStore().latestRevision(LEGACY_WORKSPACE)).toBe(2)
  })
})
