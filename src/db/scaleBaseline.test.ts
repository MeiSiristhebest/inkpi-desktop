import { describe, expect, it } from 'vitest'
import type { DomainChangeSet } from '@inkpi/protocol'
import type { CodexEntity } from '../plugins/living-codex/types'
import type { TimelineNode } from '../plugins/timeline-grid/types'
import type { ChapterRecord } from '../types'
import { IndexedDbDomainChangeStore } from '../adapters/indexedDbDomainChangeStore'
import { createDomainChangeSet } from '../domain/sync/domainChangeSet'
import { storyStateMaterializer } from '../services/storyStateMaterializer'
import { DB_NAME, db, type StoreName } from './indexedDB'

/**
 * P7 scale baseline for the durable desktop store. A full-length manuscript is ~1000 chapters
 * and ~1M CJK characters, and the plugin surfaces sit on top of a 2000-entity codex and a
 * 1500-node timeline, so read-model correctness has to be proven at that size rather than on a
 * five-record fixture.
 *
 * Timings are asserted as growth ratios against a 4x smaller dataset: the CI runner's absolute
 * speed is irrelevant, but a scan that turns quadratic at manuscript size is not.
 */

const BASE_TIME = 1_700_000_000_000
const CHARS_PER_CHAPTER = 1000
const CHAPTERS_PER_PROJECT = 250
const INDEXED_GROWTH_CEILING = 6
/** Scanned-row growth, not result-set growth, so the manuscript listing gets a linear ceiling. */
const LINEAR_GROWTH_CEILING = 12
/**
 * A project's own listing must not pay for the projects sitting next to it in the same store.
 * Measured: an index-backed re-read of 250 chapters costs the same before and after 1000 unrelated
 * chapters land (x1.0), while the degraded full-store clone the wrapper falls back to costs x2.9.
 */
const PROJECT_ISOLATION_CEILING = 2

const GLYPHS = [
  '寒',
  '潭',
  '惊',
  '变',
  '青',
  '灯',
  '古',
  '寺',
  '雪',
  '夜',
  '剑',
  '鸣',
  '孤',
  '舟',
  '渡',
  '霜',
  '钟',
  '阁',
  '残',
  '阳',
  '云',
  '深',
  '处',
  '长',
  '歌',
  '未',
  '央',
  '归',
  '渡',
  '口',
  '山',
  '海',
]
const CATEGORIES = ['character', 'faction', 'location', 'item'] as const

/** Deterministic CJK prose: real manuscripts are dense, and UTF-16 length is what is stored. */
function prose(seed: number, length: number): string {
  const chars: string[] = []
  for (let index = 0; index < length; index += 1) {
    chars.push(GLYPHS[(seed * 31 + index * 7) % GLYPHS.length])
  }
  return chars.join('')
}

function chapter(projectId: string, order: number): ChapterRecord {
  const content = prose(order, CHARS_PER_CHAPTER)
  return {
    id: `${projectId}-c-${String(order).padStart(4, '0')}`,
    projectId,
    volumeId: `${projectId}-v-${String(Math.floor((order - 1) / CHAPTERS_PER_PROJECT) + 1).padStart(2, '0')}`,
    title: `第${String(order).padStart(3, '0')}章 ${prose(order, 8)}`,
    content,
    wordCount: content.length,
    order,
    status: 'published',
    revision: 1,
    createdAt: BASE_TIME + order,
    updatedAt: BASE_TIME + order,
  }
}

function codexEntity(projectId: string, index: number): CodexEntity {
  return {
    id: `${projectId}-e-${String(index).padStart(4, '0')}`,
    projectId,
    name: `${prose(index, 2)}${index}`,
    aliases: [`${prose(index, 1)}某`],
    category: CATEGORIES[index % CATEGORIES.length],
    attributes: { firstAppearance: index },
    relations: [],
    summary: prose(index, 40),
    createdAt: BASE_TIME + index,
    updatedAt: BASE_TIME + index,
  }
}

function timelineNode(projectId: string, index: number): TimelineNode {
  return {
    id: `${projectId}-n-${String(index).padStart(4, '0')}`,
    projectId,
    threadId: `${projectId}-thread-${index % 12}`,
    chapterOrder: index,
    eventTitle: `${prose(index, 3)}事件`,
    summary: prose(index, 30),
    status: 'completed',
    prerequisites: [],
    causalOutcome: prose(index, 12),
    relatedEntityIds: [],
    emotionalPolarity: (index % 5) / 5 - 0.5,
    createdAt: BASE_TIME + index,
    updatedAt: BASE_TIME + index,
  }
}

/** One journal entry, contiguous by construction: revision is always baseRevision + 1. */
function journalSet(workspaceId: string, baseRevision: number, tag = String(baseRevision + 1)) {
  return createDomainChangeSet({
    id: `${workspaceId}-set-${tag}`,
    workspaceId,
    sourceDeviceId: 'scale-runner',
    baseRevision,
    changes: [
      {
        id: `${workspaceId}-change-${tag}`,
        aggregateType: 'chapter',
        aggregateId: `${workspaceId}-c-${tag}`,
        operation: 'upsert',
        revision: baseRevision + 1,
        payload: { wordCount: baseRevision + 1 },
        occurredAt: BASE_TIME + baseRevision,
      },
    ],
    createdAt: BASE_TIME + baseRevision,
  })
}

function journalSets(workspaceId: string, count: number): DomainChangeSet[] {
  return Array.from({ length: count }, (_, index) => journalSet(workspaceId, index))
}

async function putAll<T extends { id: string }>(store: StoreName, records: T[]): Promise<void> {
  await db.runTransaction([store], (transaction) => {
    for (const record of records) transaction.objectStore(store).put(record)
  })
}

/** The listing pattern the editor shell and sidebar actually use for a project's chapters. */
async function listChapters(projectId: string): Promise<ChapterRecord[]> {
  const records = await db.getByIndex<ChapterRecord>('chapters', 'projectId', projectId)
  return records.sort((a, b) => a.order - b.order)
}

async function measureMs(
  runs: number,
  repeats: number,
  operation: () => Promise<unknown>,
): Promise<number> {
  await operation()
  let best = Number.POSITIVE_INFINITY
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now()
    for (let repeat = 0; repeat < repeats; repeat += 1) await operation()
    best = Math.min(best, performance.now() - started)
  }
  return best
}

/** Floors tiny baselines so a sub-millisecond small dataset cannot manufacture a huge ratio. */
function growthRatio(smallMs: number, largeMs: number): number {
  return largeMs / Math.max(smallMs, 1)
}

/** Opens the same durable database the wrapper holds, to inspect schema the wrapper hides. */
function openExistingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error(`Opening ${DB_NAME} was blocked by another connection`))
  })
}

describe('P7 desktop scale baseline', () => {
  it('writes a 1000-chapter manuscript without loss and lists it without other projects', async () => {
    // The control project is seeded first, so its listing is timed against a store that holds only
    // its own rows before the manuscript lands.
    await putAll(
      'chapters',
      Array.from({ length: 250 }, (_, index) => chapter('p-scale-small', index + 1)),
    )
    const ownRowsMs = await measureMs(3, 5, () => listChapters('p-scale-small'))
    expect((await listChapters('p-scale-small')).length).toBe(250)

    const orders = Array.from({ length: 1000 }, (_, index) => index + 1)
    await putAll(
      'chapters',
      orders.map((order) => chapter('p-scale-main', order)),
    )
    const mainMs = await measureMs(3, 5, () => listChapters('p-scale-main'))

    const listed = await listChapters('p-scale-main')
    expect(listed.length).toBe(1000)
    expect((await db.getAll('chapters')).length).toBe(1250)
    let expectedTotalChars = 0
    for (const order of orders) expectedTotalChars += chapter('p-scale-main', order).content.length
    expect(expectedTotalChars).toBeGreaterThanOrEqual(1_000_000)
    expect(listed.reduce((total, record) => total + record.wordCount, 0)).toBe(expectedTotalChars)

    // Order integrity across the whole manuscript, and byte-exact content at both ends and middle.
    expect(listed.map((record) => record.order)).toEqual(orders)
    for (const order of [1, 97, 250, 251, 500, 512, 873, 1000]) {
      const record = listed.find((item) => item.order === order)
      expect(record?.content).toBe(chapter('p-scale-main', order).content)
      expect(record?.content.length).toBe(CHARS_PER_CHAPTER)
      expect(record?.volumeId).toBe(
        `p-scale-main-v-${String(Math.floor((order - 1) / CHAPTERS_PER_PROJECT) + 1).padStart(2, '0')}`,
      )
    }

    // An index read must serve a project's listing out of its own rows: re-reading the control
    // project after 1000 unrelated chapters landed costs about what it cost before them. Without
    // the projectId index getByIndex degrades to cloning all 1250 rows, which measures ~x2.9.
    const afterGrowthMs = await measureMs(3, 5, () => listChapters('p-scale-small'))
    const isolationRatio = growthRatio(ownRowsMs, afterGrowthMs)
    expect(isolationRatio).toBeLessThanOrEqual(PROJECT_ISOLATION_CEILING)

    // Cost aside, the index must agree row-for-row with the predicate it replaces.
    const bruteForce = (await db.getAll<ChapterRecord>('chapters'))
      .filter((record) => record.projectId === 'p-scale-main')
      .map((record) => record.id)
      .sort()
    expect(
      listed
        .map((record) => record.id)
        .slice()
        .sort(),
    ).toEqual(bruteForce)

    // A project's own listing still scales with the rows it returns, not with the store.
    const ratio = growthRatio(ownRowsMs, mainMs)
    expect(ratio).toBeLessThanOrEqual(LINEAR_GROWTH_CEILING)
    console.log(
      `P7 chapter listing: 250-row store ${ownRowsMs.toFixed(1)}ms -> 1000 rows ${mainMs.toFixed(1)}ms ` +
        `(x${ratio.toFixed(2)} of ceiling ${LINEAR_GROWTH_CEILING}); control project re-read from a ` +
        `1250-row store ${afterGrowthMs.toFixed(1)}ms (x${isolationRatio.toFixed(2)} of ceiling ` +
        `${PROJECT_ISOLATION_CEILING})`,
    )
  })

  it('keeps project-scoped chapter reads exact and isolated at manuscript scale', async () => {
    // Structural half of the isolation gate: getByIndex degrades to a full-store filter when an
    // index is absent, so the timing assertion alone could be satisfied by a store that never
    // grew. The index has to actually exist on the chapters store.
    const raw = await openExistingDatabase()
    try {
      const store = raw.transaction('chapters', 'readonly').objectStore('chapters')
      expect(Array.from(store.indexNames)).toContain('projectId')
    } finally {
      raw.close()
    }

    const projects = ['p-scale-small', 'p-scale-main']
    const byProject = new Map<string, ChapterRecord[]>()
    for (const projectId of projects) byProject.set(projectId, await listChapters(projectId))

    // Every stored row must be attributable to exactly one project: no leakage, no drops.
    const all = await db.getAll<ChapterRecord>('chapters')
    const seen = projects.reduce(
      (total, projectId) => total + (byProject.get(projectId)?.length ?? 0),
      0,
    )
    expect(seen).toBe(all.length)
    for (const projectId of projects) {
      for (const record of byProject.get(projectId) ?? []) {
        expect(record.projectId).toBe(projectId)
      }
    }

    // A project that holds nothing reads as nothing, not as somebody else's manuscript.
    expect(await listChapters('p-scale-empty')).toEqual([])
    expect((await db.getAll<ChapterRecord>('volumes')).length).toBe(0)
  })

  it('serves 2000 codex entities and 1500 timeline nodes by exact index sets', async () => {
    const entities = Array.from({ length: 2000 }, (_, index) => codexEntity('p-scale-main', index))
    const nodes = Array.from({ length: 1500 }, (_, index) => timelineNode('p-scale-main', index))
    await putAll('codexEntities', entities)
    await putAll('timelineNodes', nodes)
    // A second project so a category read must prove it spans projects correctly, not by luck.
    await putAll(
      'codexEntities',
      Array.from({ length: 500 }, (_, index) => codexEntity('p-scale-codex-small', index)),
    )

    const scoped = await db.getByIndex<CodexEntity>('codexEntities', 'projectId', 'p-scale-main')
    expect(scoped.length).toBe(2000)
    expect(new Set(scoped.map((entity) => entity.projectId))).toEqual(new Set(['p-scale-main']))
    expect(new Set(scoped.map((entity) => entity.id)).size).toBe(2000)

    // The category index must return exactly what a full-store filter returns — 500 from the
    // manuscript project plus 125 from the control project — so the index is real and complete.
    const characters = await db.getByIndex<CodexEntity>('codexEntities', 'category', 'character')
    const bruteForce = (await db.getAll<CodexEntity>('codexEntities')).filter(
      (entity) => entity.category === 'character',
    )
    expect(characters.length).toBe(625)
    expect(characters.every((entity) => entity.category === 'character')).toBe(true)
    expect(characters.map((entity) => entity.id).sort()).toEqual(
      bruteForce.map((entity) => entity.id).sort(),
    )
    expect(
      scoped
        .filter((entity) => entity.category === 'character')
        .map((entity) => entity.id)
        .sort(),
    ).toEqual(
      characters
        .filter((entity) => entity.projectId === 'p-scale-main')
        .map((entity) => entity.id)
        .sort(),
    )

    // Range reads over an ordered index are how the timeline grid pages a 1500-node board.
    const window = await db.getByIndex<TimelineNode>(
      'timelineNodes',
      'chapterOrder',
      IDBKeyRange.bound(400, 599),
    )
    expect(window.length).toBe(200)
    expect(Math.min(...window.map((node) => node.chapterOrder))).toBe(400)
    expect(Math.max(...window.map((node) => node.chapterOrder))).toBe(599)
    const byThread = await db.getByIndex<TimelineNode>(
      'timelineNodes',
      'threadId',
      'p-scale-main-thread-3',
    )
    expect(byThread.length).toBe(125)
    expect(byThread.every((node) => node.threadId === 'p-scale-main-thread-3')).toBe(true)
  })

  it('materializes one project read model out of a shared manuscript-scale store', async () => {
    // The read-model refresh runs after every domain write, so its reads must be scoped by
    // project index rather than by the whole store: this project owns 500 of the 2500 entities.
    const state = await storyStateMaterializer.materialize('p-scale-codex-small')
    expect(state).toBeDefined()
    expect(Object.keys(state!.entities)).toHaveLength(500)
    expect(state!.entities['p-scale-codex-small-e-0000']).toBeDefined()
    expect(state!.entities['p-scale-codex-small-e-0499']).toBeDefined()

    // No leakage from the 2000-entity manuscript project sharing the same stores.
    const foreignKeys = Object.keys(state!.entities).filter((key) =>
      key.startsWith('p-scale-main-e-'),
    )
    expect(foreignKeys).toEqual([])
    expect(state!.timelines).toEqual({})
  })

  it('reads and appends one workspace journal without cloning the neighbours', async () => {
    const journal = new IndexedDbDomainChangeStore()
    const own = 'p-journal-main'
    const neighbour = 'p-journal-neighbour'

    // Structural half of the gate, for the same reason as the chapters one: both getByIndex and
    // readIndexInTransaction fall back to a full-store filter when the index is absent, so timing
    // alone could be satisfied by a store that simply never grew. The index has to exist.
    const raw = await openExistingDatabase()
    try {
      const store = raw.transaction('domainChangeSets', 'readonly').objectStore('domainChangeSets')
      expect(Array.from(store.indexNames)).toContain('workspaceId')
    } finally {
      raw.close()
    }

    await putAll('domainChangeSets', journalSets(own, 40))
    const ownRowsMs = await measureMs(3, 5, () => journal.list(own))
    expect((await journal.list(own)).at(-1)?.revision).toBe(40)

    // A neighbour with a 75x longer journal now shares the one store. This is the shape a
    // returning author is in: the autosave path re-reads the journal head on every keystroke.
    await putAll('domainChangeSets', journalSets(neighbour, 3000))

    const afterGrowthMs = await measureMs(3, 5, () => journal.list(own))
    const isolationRatio = growthRatio(ownRowsMs, afterGrowthMs)
    expect(isolationRatio).toBeLessThanOrEqual(PROJECT_ISOLATION_CEILING)

    // Cost aside, the index must agree with the predicate it replaced, revision for revision.
    const listed = await journal.list(own)
    expect(listed.map((changeSet) => changeSet.revision)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1),
    )
    const bruteForce = (await db.getAll<DomainChangeSet>('domainChangeSets'))
      .filter((changeSet) => changeSet.workspaceId === own)
      .map((changeSet) => changeSet.id)
      .sort()
    expect(
      listed
        .map((changeSet) => changeSet.id)
        .slice()
        .sort(),
    ).toEqual(bruteForce)
    expect(await journal.latestRevision(neighbour)).toBe(3000)

    // The compare-and-set head must come from this workspace alone: the next revision is accepted
    // into a 3040-entry store, and a stale revision is rejected as a conflict rather than silently
    // accepted because some other workspace had already grown past it.
    await journal.append(journalSet(own, 40))
    expect(await journal.latestRevision(own)).toBe(41)
    await expect(journal.append(journalSet(own, 39, 'stale'))).rejects.toThrow(/revision conflict/)
    expect(await journal.latestRevision(own)).toBe(41)
    expect(await journal.latestRevision(neighbour)).toBe(3000)

    console.log(
      `P7 domain journal: 40-entry workspace read ${ownRowsMs.toFixed(1)}ms -> from a ` +
        `3040-entry store ${afterGrowthMs.toFixed(1)}ms (x${isolationRatio.toFixed(2)} of ceiling ` +
        `${PROJECT_ISOLATION_CEILING})`,
    )
  })

  it('keeps index-backed reads near-flat from 500 to 2000 codex entities', async () => {
    const smallMs = await measureMs(3, 10, () =>
      db.getByIndex<CodexEntity>('codexEntities', 'projectId', 'p-scale-codex-small'),
    )
    const largeMs = await measureMs(3, 10, () =>
      db.getByIndex<CodexEntity>('codexEntities', 'projectId', 'p-scale-main'),
    )
    const ratio = growthRatio(smallMs, largeMs)
    // 4x the rows returned, but an index lookup cost per row, so a near-flat ceiling still
    // catches a scan-per-read regression.
    expect(ratio).toBeLessThanOrEqual(INDEXED_GROWTH_CEILING * 4)
    console.log(
      `P7 codex index read: 500 rows ${smallMs.toFixed(1)}ms -> 2000 rows ${largeMs.toFixed(1)}ms ` +
        `(x${ratio.toFixed(2)} of ceiling ${(INDEXED_GROWTH_CEILING * 4).toFixed(0)} for 4x returned rows)`,
    )
  })
})
