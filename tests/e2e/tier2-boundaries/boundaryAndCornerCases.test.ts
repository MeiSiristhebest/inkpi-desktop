// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../src/db/indexedDB'
import { pluginEventBus } from '../../../src/core/pluginEventBus'
import { indexedDbProjectRepository } from '../../../src/adapters/indexedDbProjectRepository'
import { indexedDbPowerTierRepository } from '../../../src/adapters/indexedDbPowerTierRepository'
import { indexedDbScrapbookRepository } from '../../../src/adapters/indexedDbScrapbookRepository'
import { indexedDbVolumeArcRepository } from '../../../src/adapters/indexedDbVolumeArcRepository'
import { waterMeterEngine } from '../../../src/plugins/water-meter/engine/WaterMeterEngine'
import { RhythmRadarEngine } from '../../../src/plugins/rhythm-radar/engine/RhythmRadarEngine'
import { expectationEngine } from '../../../src/plugins/expectation-engine/engine/ExpectationEngine'
import { ConsistencyEngine } from '../../../src/plugins/consistency-sentinel/engine/ConsistencyEngine'
import { CodexGraphStore } from '../../../src/plugins/living-codex/engine/GraphStore'
import { ScrapbookEngine } from '../../../src/plugins/scrapbook-recycler/engine/ScrapbookEngine'
import { PhoneticsEvaluator } from '../../../src/plugins/name-forge/engine/PhoneticsEvaluator'
import { VolumeMasterEngine } from '../../../src/plugins/volume-master/engine/VolumeMasterEngine'
import { projectContent } from '../../../src/domain/content'
import { countWords } from '../../../src/domain/text'
import { TestHostHarness, createScopedEventBus, PINYIN_TONE_DICTIONARY } from '../harness'
import type { ChapterRecord } from '../../../src/types'
import type { CodexEntity } from '../../../src/plugins/living-codex/types'
import type { VolumeArcRecord } from '../../../src/ports/volumeArcRepository'

type TestRecord = {
  id?: unknown
  key?: unknown
  projectId?: unknown
  workspaceId?: unknown
}

const cleanupStores = [
  'chapters',
  'codexEntities',
  'powerTierSystems',
  'scrapbookFragments',
  'volumeArcs',
  'domainChangeSets',
  'dailyStats',
] as const

async function cleanupProject(projectId: string): Promise<void> {
  for (const store of cleanupStores) {
    const records = await db.getAll<TestRecord>(store)
    for (const record of records) {
      const belongsToProject =
        record.projectId === projectId ||
        record.workspaceId === projectId ||
        (store === 'powerTierSystems' && record.id === projectId)
      if (!belongsToProject) continue

      const key =
        store === 'powerTierSystems' ? projectId : store === 'dailyStats' ? record.key : record.id
      if (typeof key === 'string') await db.delete(store, key)
    }
  }
}

function makeChapter(projectId: string, id: string, content: string, revision = 1): ChapterRecord {
  const now = Date.now()
  return {
    id,
    projectId,
    volumeId: `${projectId}::volume-1`,
    title: '边界测试章节',
    content,
    wordCount: countWords(content),
    order: 1,
    status: 'draft',
    revision,
    createdAt: now,
    updatedAt: now,
  }
}

function makeEntity(projectId: string, id: string, name: string): CodexEntity {
  const now = Date.now()
  return {
    id,
    projectId,
    name,
    aliases: [],
    category: 'character',
    attributes: { realm: '筑基期' },
    relations: [],
    summary: `${name} 的角色设定`,
    createdAt: now,
    updatedAt: now,
  }
}

describe('Tier 2: Boundary and Corner Cases', () => {
  let projectId = ''

  beforeEach(() => {
    projectId = `test-proj-${crypto.randomUUID()}`
    pluginEventBus.clear()
  })

  afterEach(async () => {
    pluginEventBus.clear()
    await cleanupProject(projectId)
  })

  it('TC-BOUNDARY-01: Keeps empty text analysis finite and side-effect free', () => {
    const chapterId = `${projectId}::empty-chapter`
    const received: unknown[] = []
    const unsubscribe = createScopedEventBus(projectId).on('CHAPTER_CONTENT_AUDITED', (payload) => {
      received.push(payload)
    })

    const water = waterMeterEngine.auditText('', { projectId, chapterId })
    const rhythm = RhythmRadarEngine.analyzeChapter('', chapterId, 1)
    const tension = expectationEngine.computeTensionIntegral('')
    const semantic = projectContent(chapterId, '')

    expect(water.totalWordCount).toBe(0)
    expect(water.waterScore).toBe(0)
    expect(rhythm.tensionScore).toBe(0.3)
    expect(tension).toEqual({ suppressionArea: 0, payoffArea: 0, dynamicSpr: 1 })
    expect(semantic.text).toBe('')
    expect(received).toHaveLength(0)

    unsubscribe()
  })

  it('TC-BOUNDARY-02: Persists a valid CAS full replacement whose resulting text is empty', async () => {
    const chapter = makeChapter(projectId, `${projectId}::empty-write`, '需要清空的草稿')
    await indexedDbProjectRepository.saveChapter(chapter)

    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    const audited: Array<{ chapterId: string; wordCount: number }> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })

    const result = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: '',
    })

    expect(result.success).toBe(true)
    expect(result.updatedContent).toBe('')
    expect(result.currentRevision).toBe(2)
    expect(audited).toEqual([{ projectId, chapterId: chapter.id, wordCount: 0 }])

    const updated = { ...harness.activeChapter!, wordCount: 0 }
    await indexedDbProjectRepository.saveChapter(updated)
    const persisted = (await indexedDbProjectRepository.getChaptersByProject(projectId)).find(
      (item) => item.id === chapter.id,
    )
    expect(persisted?.content).toBe('')
    expect(persisted?.revision).toBe(2)

    unsubscribe()
  })

  it('TC-BOUNDARY-03: Allows only one winner when two actors race on the same CAS revision', async () => {
    const chapter = makeChapter(projectId, `${projectId}::cas-race`, '初始版本。')
    await indexedDbProjectRepository.saveChapter(chapter)

    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    const audited: Array<{ chapterId: string; wordCount: number }> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })

    const [first, second] = await Promise.all([
      harness.mutateActiveChapter({
        chapterId: chapter.id,
        expectedRevision: 1,
        type: 'full_replace',
        content: '并发写入甲。',
      }),
      harness.mutateActiveChapter({
        chapterId: chapter.id,
        expectedRevision: 1,
        type: 'full_replace',
        content: '并发写入乙。',
      }),
    ])

    const results = [first, second]
    expect(results.filter((result) => result.success)).toHaveLength(1)
    expect(results.filter((result) => result.conflict === true)).toHaveLength(1)
    expect(harness.revision).toBe(2)
    expect(audited).toHaveLength(1)
    expect(harness.activeChapter?.content).toBe(first.success ? '并发写入甲。' : '并发写入乙。')

    await indexedDbProjectRepository.saveChapter({
      ...harness.activeChapter!,
      wordCount: countWords(harness.activeChapter!.content),
    })
    const persisted = (await indexedDbProjectRepository.getChaptersByProject(projectId)).find(
      (item) => item.id === chapter.id,
    )
    expect(persisted?.revision).toBe(2)
    expect(persisted?.content).toBe(harness.activeChapter?.content)

    unsubscribe()
  })

  it('TC-BOUNDARY-04: Rejects a cyclic power hierarchy and stores the project-scoped system', async () => {
    const tiers = ['黄阶', '玄阶', '地阶']
    const relations = [
      { lowerTier: '黄阶', higherTier: '玄阶' },
      { lowerTier: '玄阶', higherTier: '地阶' },
      { lowerTier: '地阶', higherTier: '黄阶' },
    ]
    const system = {
      projectId,
      systemName: '边界循环体系',
      tiers,
      specialModifiers: ['偷袭'],
      updatedAt: Date.now(),
    }

    await indexedDbPowerTierRepository.save(system)
    const persisted = await indexedDbPowerTierRepository.get(projectId)
    const engine = new ConsistencyEngine()
    const validation = engine.validatePowerHierarchy(persisted!, relations)
    const violations = engine.scanPowerHierarchyCycles(persisted!, relations)

    expect(persisted?.projectId).toBe(projectId)
    expect(validation.isAcyclic).toBe(false)
    expect(validation.cycles).toEqual([['黄阶', '玄阶', '地阶', '黄阶']])
    expect(violations).toHaveLength(1)
    expect(violations[0].type).toBe('power_hierarchy_cycle')
    expect(violations[0].severity).toBe('critical')
  })

  it('TC-BOUNDARY-05: Returns no codex context when the token capacity cannot pay the tag overhead', () => {
    const entity = makeEntity(projectId, `${projectId}::codex`, '楚凌霄')
    const graph = new CodexGraphStore()
    graph.updateDataset([entity])

    const overflow = graph.resolveContextSlice('楚凌霄', 20)
    const withCapacity = graph.resolveContextSlice('楚凌霄', 200)

    expect(overflow).toEqual({ matchedEntities: [], xmlContext: '', totalEstimatedTokens: 0 })
    expect(withCapacity.matchedEntities.map((item) => item.id)).toEqual([entity.id])
    expect(withCapacity.xmlContext).toContain('<living_codex_context>')
    expect(withCapacity.totalEstimatedTokens).toBeLessThanOrEqual(200)
  })

  it('TC-BOUNDARY-06: Keeps single-document IDF finite while scrapbook retrieval remains usable', async () => {
    const fragment = {
      id: `${projectId}::fragment`,
      projectId,
      snippet: '夜色浓稠如墨，狂风撕扯着古刹的破旧幡旗。',
      wordCount: 22,
      deletedAt: Date.now(),
      tags: ['古刹', '狂风'],
      isReused: false,
    }
    await indexedDbScrapbookRepository.save(fragment)
    const persisted = await indexedDbScrapbookRepository.getAll(projectId)
    const tokens = ScrapbookEngine.tokenize(persisted[0].snippet)
    const expectedSingleDocumentIdf = Math.log(1 + 1 / 2) + 1

    // The harness oracle is the authoritative corpus-level IDF definition.
    const { computeCorpusIdf, computeTfIdfCosine } = await import('../harness/mathOracles')
    const idf = computeCorpusIdf([{ id: fragment.id, text: fragment.snippet, tokens }])
    const cosine = computeTfIdfCosine(['古刹'], tokens, idf)
    const recommendations = ScrapbookEngine.recommendFragments('古刹', persisted, 1)

    expect(idf.get('古刹')).toBeCloseTo(expectedSingleDocumentIdf, 10)
    expect(Number.isFinite(cosine)).toBe(true)
    expect(cosine).toBeGreaterThan(0)
    expect(recommendations[0].fragment.id).toBe(fragment.id)
    expect(recommendations[0].matchedKeywords).toContain('古刹')
  })

  it('TC-BOUNDARY-07: Uses dictionary tones for characters that disagree with Unicode parity', () => {
    for (const character of ['锋', '尊', '岳']) {
      expect(PhoneticsEvaluator.getTone(character)).toBe(PINYIN_TONE_DICTIONARY[character])
    }

    expect('锋'.charCodeAt(0) % 2).toBe(1)
    expect(PhoneticsEvaluator.getTonePattern('锋岳')).toBe('平仄')
    expect(PhoneticsEvaluator.analyzeToneFluctuation('锋岳')).toMatchObject({
      pattern: '平仄',
      isAlternating: true,
      cadence: 'ze',
    })
  })

  it('TC-BOUNDARY-08: Treats a flat tension curve as a finite degenerate OLS fit', async () => {
    const volumeId = `${projectId}::volume`
    const arc: VolumeArcRecord = {
      id: `${projectId}::arc`,
      projectId,
      volumeId,
      volumeTitle: '平直卷',
      volumeOrder: 1,
      targetWordCount: 100,
      coreConflict: '保持平稳',
      climaxNode: '',
      rewardOutcome: '',
      crossVolumeCliffhanger: '',
      actStage: 'act2_rising',
      updatedAt: Date.now(),
    }
    await indexedDbVolumeArcRepository.save(arc)

    const engine = new VolumeMasterEngine()
    const ols = engine.computeOlsQuadratic([
      { x: 0, y: 0.4 },
      { x: 0.25, y: 0.4 },
      { x: 0.5, y: 0.4 },
      { x: 0.75, y: 0.4 },
      { x: 1, y: 0.4 },
    ])
    const fit = engine.fitNarrativeArcR2([0.4, 0.4, 0.4, 0.4, 0.4])
    const persistedArc = await indexedDbVolumeArcRepository.getByVolumeId(projectId, volumeId)

    expect(persistedArc?.id).toBe(arc.id)
    expect(ols.beta0).toBeCloseTo(0.4, 8)
    expect(ols.beta1).toBeCloseTo(0, 8)
    expect(ols.beta2).toBeCloseTo(0, 8)
    expect(ols.r2).toBe(1)
    expect(ols.apexRatio).toBe(-1)
    expect(fit).toEqual({ r2: 1, apexPositionRatio: 0 })
  })
})
