import { describe, expect, it } from 'vitest'
import { DB_NAME, db, type StoreName } from '../db/indexedDB'
import type { ChapterBeatPlan } from '../plugins/scene-beats/types'
import type { GeoMapGridRecord } from '../ports/geoMapRepository'
import type { IronChamberRecord } from '../ports/ironChamberRepository'
import type { MemoryPalaceSnapshotRecord } from '../ports/memoryPalaceRepository'
import type { MultiCalendarProjectRecord } from '../ports/multiCalendarRepository'
import type { PaywallAuditRecord } from '../ports/paywallAuditRepository'
import type { PovSnapshotRecord } from '../ports/povGuardRepository'
import type { ReaderSimulationRecord } from '../ports/readerSimulationRepository'
import type { RhythmRadarReportRecord } from '../ports/rhythmRadarRepository'
import type { EmotionAuditRecord } from '../ports/emotionAuditRepository'
import { indexedDbEmotionAuditRepository } from './indexedDbEmotionAuditRepository'
import { indexedDbGeoMapRepository } from './indexedDbGeoMapRepository'
import { indexedDbIronChamberRepository } from './indexedDbIronChamberRepository'
import { indexedDbMemoryPalaceRepository } from './indexedDbMemoryPalaceRepository'
import { indexedDbMultiCalendarRepository } from './indexedDbMultiCalendarRepository'
import { indexedDbPaywallAuditRepository } from './indexedDbPaywallAuditRepository'
import { indexedDbPovGuardRepository } from './indexedDbPovGuardRepository'
import { indexedDbReaderSimulationRepository } from './indexedDbReaderSimulationRepository'
import { indexedDbRhythmRadarRepository } from './indexedDbRhythmRadarRepository'
import { indexedDbSceneBeatRepository } from './indexedDbSceneBeatRepository'

/**
 * These ten plugin adapters take a scoped key (chapter, location, entity or project) and used to
 * satisfy it by cloning their whole store and calling `find` on the result. They now open a cursor
 * on the matching index, which makes two things worth pinning down:
 *
 * 1. the index has to actually exist, because `db.getByIndex` degrades to the old whole-store
 *    filter in silence when it does not;
 * 2. a key that matches more than one record has to resolve to the same record it resolved to
 *    before, because the adapters return the first hit rather than a list.
 */

const OWN = 'lookup-own'
const NEIGHBOUR = 'lookup-neighbour'

function openExistingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error(`Opening ${DB_NAME} was blocked by another connection`))
  })
}

async function indexNames(store: StoreName): Promise<string[]> {
  const raw = await openExistingDatabase()
  try {
    const objectStore = raw.transaction(store, 'readonly').objectStore(store)
    return Array.from(objectStore.indexNames)
  } finally {
    raw.close()
  }
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

function beatPlan(id: string, projectId: string, chapterId: string): ChapterBeatPlan {
  return {
    id,
    projectId,
    chapterId,
    targetWordCount: 3000,
    beats: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

function geoGrid(id: string, projectId: string, locationId: string): GeoMapGridRecord {
  return {
    id,
    projectId,
    locationId,
    scaleKmPerCell: 1,
    bounds: { minX: 0, minY: 0, maxX: 8, maxY: 8 },
    occupiedCells: [],
    linkedOverlays: { activeCharacterIds: [], foreshadowIds: [], timelineEventIds: [] },
    updatedAt: 1,
  }
}

function radarReport(id: string, projectId: string, chapterId: string): RhythmRadarReportRecord {
  return {
    id,
    projectId,
    chapterId,
    chapterOrder: 1,
    tensionScore: 0.6,
    pacingStatus: 'optimal',
    cliffhanger: {
      type: 'info_twist',
      recommendedCutSnippet: '',
      hookPrompt: '',
      punchline: '',
    },
    actionDensity: 0.4,
    sentimentValence: 0.1,
    generatedAt: 1,
  }
}

function readerSimulation(
  id: string,
  projectId: string,
  chapterId: string,
): ReaderSimulationRecord {
  return {
    id,
    projectId,
    chapterId,
    chapterTitle: id,
    chapterOrder: 1,
    toxicityScore: 10,
    logicScore: 70,
    pleasureScore: 60,
    comments: [],
    toxicAlerts: [],
    suggestions: [],
    updatedAt: 1,
  }
}

function povSnapshot(id: string, projectId: string, chapterId: string): PovSnapshotRecord {
  return {
    id,
    projectId,
    chapterId,
    chapterOrder: 1,
    povCharacterId: 'c-1',
    povCharacterName: '主角',
    povMode: 'third_limited',
    allowedCharacters: [],
    secrets: [],
    headHoppingViolationsCount: 0,
    omniscienceLeaksCount: 0,
    updatedAt: 1,
  }
}

function paywallAudit(id: string, projectId: string, chapterId: string): PaywallAuditRecord {
  return {
    id,
    projectId,
    chapterId,
    chapterTitle: id,
    chapterOrder: 1,
    wordCount: 3000,
    ppiScore: 72,
    cliffhangerScore: 65,
    unresolvedDesireScore: 58,
    powerClimaxScore: 70,
    fatigueRiskScore: 20,
    recommendation: 'acceptable',
    suggestions: [],
    updatedAt: 1,
  }
}

function palaceSnapshot(
  id: string,
  projectId: string,
  entityId: string,
): MemoryPalaceSnapshotRecord {
  return {
    id,
    projectId,
    entityId,
    entityName: entityId,
    category: 'character',
    aliases: [],
    totalOccurrences: 0,
    occurrences: [],
    updatedAt: 1,
  }
}

function emotionAudit(id: string, projectId: string, chapterId: string): EmotionAuditRecord {
  return {
    id,
    projectId,
    chapterId,
    chapterTitle: id,
    chapterOrder: 1,
    wordCount: 3000,
    vector: { tension: 40, catharsis: 55, frustration: 20, anticipation: 60, sorrow: 10, joy: 30 },
    netPolarity: 15,
    dominantEmotion: 'anticipation',
    resonanceScore: 62,
    warnings: [],
    suggestions: [],
    updatedAt: 1,
  }
}

function calendar(id: string, projectId: string): MultiCalendarProjectRecord {
  return { id, projectId, calendars: [], chronologyEvents: [], updatedAt: 1 }
}

function chamber(id: string, projectId: string, status: IronChamberRecord['status']) {
  return {
    id,
    projectId,
    mode: 'words' as const,
    targetWords: 5000,
    targetMinutes: 90,
    startWords: 0,
    currentWords: 1200,
    status,
    pledgedAt: 1,
  }
}

describe('index-backed single-record plugin reads', () => {
  it('every store these adapters read is indexed by the key they query', async () => {
    // Only the wrapper knows the upgrade schema, so the first access has to go through it: opening
    // the raw database on a fresh test file would create an empty library with no stores at all.
    await db.getAll('sceneBeats')

    const reads: Array<[StoreName, string]> = [
      ['sceneBeats', 'chapterId'],
      ['geoMapGrids', 'locationId'],
      ['rhythmRadarReports', 'chapterId'],
      ['readerSimulations', 'chapterId'],
      ['povSnapshots', 'chapterId'],
      ['paywallAudits', 'chapterId'],
      ['emotionAudits', 'chapterId'],
      ['memoryPalaceSnapshots', 'entityId'],
      ['multiCalendars', 'projectId'],
      ['ironChamberRecords', 'projectId'],
    ]
    for (const [store, indexName] of reads) {
      expect(await indexNames(store), store).toContain(indexName)
    }
  })

  it('resolves each scoped key to its own record and a miss to undefined', async () => {
    await dropAll('sceneBeats')
    await dropAll('geoMapGrids')
    await dropAll('rhythmRadarReports')
    await dropAll('readerSimulations')
    await dropAll('povSnapshots')
    await dropAll('paywallAudits')
    await dropAll('emotionAudits')
    await dropAll('memoryPalaceSnapshots')
    await dropAll('multiCalendars')
    await dropAll('ironChamberRecords')

    await putAll('sceneBeats', [
      beatPlan('beat-own', OWN, 'ch-own'),
      beatPlan('beat-neighbour', NEIGHBOUR, 'ch-neighbour'),
    ])
    await putAll('geoMapGrids', [
      geoGrid('grid-own', OWN, 'loc-own'),
      geoGrid('grid-neighbour', NEIGHBOUR, 'loc-neighbour'),
    ])
    await putAll('rhythmRadarReports', [
      radarReport('radar-own', OWN, 'ch-own'),
      radarReport('radar-neighbour', NEIGHBOUR, 'ch-neighbour'),
    ])
    await putAll('readerSimulations', [
      readerSimulation('sim-own', OWN, 'ch-own'),
      readerSimulation('sim-neighbour', NEIGHBOUR, 'ch-neighbour'),
    ])
    await putAll('povSnapshots', [
      povSnapshot('pov-own', OWN, 'ch-own'),
      povSnapshot('pov-neighbour', NEIGHBOUR, 'ch-neighbour'),
    ])
    await putAll('paywallAudits', [
      paywallAudit('pay-own', OWN, 'ch-own'),
      paywallAudit('pay-neighbour', NEIGHBOUR, 'ch-neighbour'),
    ])
    await putAll('emotionAudits', [
      emotionAudit('emo-own', OWN, 'ch-own'),
      emotionAudit('emo-neighbour', NEIGHBOUR, 'ch-neighbour'),
    ])
    await putAll('memoryPalaceSnapshots', [
      palaceSnapshot('palace-own', OWN, 'ent-own'),
      palaceSnapshot('palace-neighbour', NEIGHBOUR, 'ent-neighbour'),
    ])
    await putAll('multiCalendars', [calendar('cal-own', OWN), calendar('cal-neighbour', NEIGHBOUR)])
    await putAll('ironChamberRecords', [
      chamber('chamber-own-draft', OWN, 'idle'),
      chamber('chamber-own-locked', OWN, 'locked'),
      chamber('chamber-neighbour-locked', NEIGHBOUR, 'locked'),
    ])

    expect(await indexedDbSceneBeatRepository.getByChapter('ch-own')).toEqual(
      expect.objectContaining({ id: 'beat-own', projectId: OWN }),
    )
    expect(await indexedDbGeoMapRepository.getByLocationId('loc-neighbour')).toEqual(
      expect.objectContaining({ id: 'grid-neighbour', projectId: NEIGHBOUR }),
    )
    expect(await indexedDbRhythmRadarRepository.getByChapter('ch-own')).toEqual(
      expect.objectContaining({ id: 'radar-own' }),
    )
    expect(await indexedDbReaderSimulationRepository.getByChapterId('ch-neighbour')).toEqual(
      expect.objectContaining({ id: 'sim-neighbour' }),
    )
    expect(await indexedDbPovGuardRepository.getByChapter('ch-own')).toEqual(
      expect.objectContaining({ id: 'pov-own' }),
    )
    expect(await indexedDbPaywallAuditRepository.getByChapterId('ch-own')).toEqual(
      expect.objectContaining({ id: 'pay-own' }),
    )
    expect(await indexedDbEmotionAuditRepository.getByChapterId('ch-neighbour')).toEqual(
      expect.objectContaining({ id: 'emo-neighbour' }),
    )
    expect(await indexedDbMemoryPalaceRepository.getByEntityId('ent-own')).toEqual(
      expect.objectContaining({ id: 'palace-own' }),
    )
    expect(await indexedDbMultiCalendarRepository.get(OWN)).toEqual(
      expect.objectContaining({ id: 'cal-own' }),
    )
    expect(await indexedDbMultiCalendarRepository.get(NEIGHBOUR)).toEqual(
      expect.objectContaining({ id: 'cal-neighbour' }),
    )

    // Iron chamber is the one compound lookup: the project narrowing now happens in the index and
    // the status predicate stays in JS, so both halves have to hold at once.
    expect(await indexedDbIronChamberRepository.getActive(OWN)).toEqual(
      expect.objectContaining({ id: 'chamber-own-locked' }),
    )
    expect(await indexedDbIronChamberRepository.getActive(NEIGHBOUR)).toEqual(
      expect.objectContaining({ id: 'chamber-neighbour-locked' }),
    )
    expect(await indexedDbIronChamberRepository.getActive('lookup-absent')).toBeUndefined()

    for (const absent of ['ch-absent', 'loc-absent', 'ent-absent']) {
      expect(await indexedDbSceneBeatRepository.getByChapter(absent)).toBeUndefined()
      expect(await indexedDbGeoMapRepository.getByLocationId(absent)).toBeUndefined()
      expect(await indexedDbRhythmRadarRepository.getByChapter(absent)).toBeUndefined()
      expect(await indexedDbReaderSimulationRepository.getByChapterId(absent)).toBeUndefined()
      expect(await indexedDbPovGuardRepository.getByChapter(absent)).toBeUndefined()
      expect(await indexedDbPaywallAuditRepository.getByChapterId(absent)).toBeUndefined()
      expect(await indexedDbEmotionAuditRepository.getByChapterId(absent)).toBeUndefined()
      expect(await indexedDbMemoryPalaceRepository.getByEntityId(absent)).toBeUndefined()
    }
    expect(await indexedDbMultiCalendarRepository.get('lookup-absent')).toBeUndefined()
  })

  it('keeps the first-hit tie-break when a scoped key is reused across projects', async () => {
    // The single-record contracts are key-based, not project-based: entity ids and chapter slots
    // can be reused by two works, and the whole-store `find` these calls replaced resolved that by
    // primary key. An index cursor is sorted by (index value, primary key), so the same record has
    // to win — otherwise indexing would silently change which snapshot an author sees.
    await dropAll('povSnapshots')
    await dropAll('memoryPalaceSnapshots')
    await putAll('povSnapshots', [
      povSnapshot('pov-z', NEIGHBOUR, 'ch-shared'),
      povSnapshot('pov-a', OWN, 'ch-shared'),
    ])
    await putAll('memoryPalaceSnapshots', [
      palaceSnapshot('palace-z', NEIGHBOUR, 'ent-shared'),
      palaceSnapshot('palace-a', OWN, 'ent-shared'),
    ])

    expect(await indexedDbPovGuardRepository.getByChapter('ch-shared')).toEqual(
      expect.objectContaining({ id: 'pov-a' }),
    )
    expect(await indexedDbMemoryPalaceRepository.getByEntityId('ent-shared')).toEqual(
      expect.objectContaining({ id: 'palace-a' }),
    )
  })
})
