// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../src/db/indexedDB'
import { pluginEventBus } from '../../../src/core/pluginEventBus'
import { indexedDbProjectRepository } from '../../../src/adapters/indexedDbProjectRepository'
import { indexedDbCodexEntityRepository } from '../../../src/adapters/indexedDbCodexEntityRepository'
import { indexedDbDiffReviewRepository } from '../../../src/adapters/indexedDbDiffReviewRepository'
import { indexedDbCombatSandboxRepository } from '../../../src/adapters/indexedDbCombatSandboxRepository'
import { indexedDbTimelineRepository } from '../../../src/adapters/indexedDbTimelineRepository'
import { indexedDbMultiCalendarRepository } from '../../../src/adapters/indexedDbMultiCalendarRepository'
import { indexedDbEmotionAuditRepository } from '../../../src/adapters/indexedDbEmotionAuditRepository'
import { waterMeterEngine } from '../../../src/plugins/water-meter/engine/WaterMeterEngine'
import { DiffReviewerEngine } from '../../../src/plugins/diff-reviewer/engine/DiffReviewerEngine'
import { CombatSandboxEngine } from '../../../src/plugins/combat-sandbox/engine/CombatSandboxEngine'
import { MultiCalendarEngine } from '../../../src/plugins/multi-calendar/engine/MultiCalendarEngine'
import { causalEngine } from '../../../src/plugins/timeline-grid/engine/CausalEngine'
import { ChapterQualityEvaluator } from '../../../src/domain/evaluator/ChapterQualityEvaluator'
import { provideLivingCodexContext } from '../../../src/plugins/living-codex/contextProvider'
import { countWords } from '../../../src/domain/text'
import { TestHostHarness } from '../harness'
import type { ChapterRecord } from '../../../src/types'
import type { CodexEntity } from '../../../src/plugins/living-codex/types'
import type { DiffReviewRecord } from '../../../src/ports/diffReviewRepository'
import type { CombatDuelRecord } from '../../../src/ports/combatSandboxRepository'
import type { TimelineNode, NarrativeThread } from '../../../src/plugins/timeline-grid/types'
import type { ChapterChronologyEvent, MultiCalendarProjectRecord } from '../../../src/ports/multiCalendarRepository'
import type { EmotionAuditRecord } from '../../../src/ports/emotionAuditRepository'

type TestRecord = {
  id?: unknown
  key?: unknown
  projectId?: unknown
  workspaceId?: unknown
}

const cleanupStores = [
  'chapters',
  'codexEntities',
  'diffReviews',
  'combatDuels',
  'multiCalendars',
  'timelineNodes',
  'narrativeThreads',
  'emotionAudits',
  'domainChangeSets',
  'dailyStats',
] as const

async function cleanupProject(projectId: string): Promise<void> {
  for (const store of cleanupStores) {
    const records = await db.getAll<TestRecord>(store)
    for (const record of records) {
      if (record.projectId !== projectId && record.workspaceId !== projectId) continue
      const key = store === 'dailyStats' ? record.key : record.id
      if (typeof key === 'string') await db.delete(store, key)
    }
  }
}

function makeChapter(projectId: string, content: string): ChapterRecord {
  const now = Date.now()
  return {
    id: `${projectId}::chapter-1`,
    projectId,
    volumeId: `${projectId}::volume-1`,
    title: '跨功能测试章节',
    content,
    wordCount: countWords(content),
    order: 1,
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
}

function makeEntity(projectId: string, name = '楚凌霄'): CodexEntity {
  const now = Date.now()
  return {
    id: `${projectId}::entity-hero`,
    projectId,
    name,
    aliases: [],
    category: 'character',
    attributes: { realm: '筑基期' },
    relations: [],
    summary: `${name} 的跨功能设定`,
    createdAt: now,
    updatedAt: now,
  }
}

async function persistActiveChapter(harness: TestHostHarness): Promise<ChapterRecord> {
  if (!harness.activeChapter) throw new Error('test harness has no active chapter')
  const record = {
    ...harness.activeChapter,
    wordCount: countWords(harness.activeChapter.content),
  }
  await indexedDbProjectRepository.saveChapter(record)
  return record
}

describe('Tier 3: Cross-Feature Workflows', () => {
  let projectId = ''

  beforeEach(() => {
    projectId = `test-proj-${crypto.randomUUID()}`
    pluginEventBus.clear()
  })

  afterEach(async () => {
    pluginEventBus.clear()
    await cleanupProject(projectId)
  })

  it('TC-CROSS-01: Closes the analysis -> CAS -> audit event -> codex mutation loop', async () => {
    const chapter = makeChapter(
      projectId,
      '众所周知，楚凌霄在寒雨中走入古城。城门外的守卫冷笑着拦路，远处雷声滚动。',
    )
    const entity = makeEntity(projectId)
    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(entity)
    await indexedDbProjectRepository.saveChapter(chapter)
    await indexedDbCodexEntityRepository.save(entity)

    const auditEvents: Array<{ chapterId: string; wordCount: number }> = []
    const codexEvents: string[] = []
    const finished = new Promise<void>((resolve, reject) => {
      harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
        auditEvents.push(payload)
        void (async () => {
          await harness.mutateCodexEntity(entity.id, (previous) => ({
            attributes: {
              ...previous.attributes,
              lastAuditWordCount: payload.wordCount,
              lastAudit: 'water-meter',
            },
          }))
          const updated = harness.getCodexEntity(entity.id)
          if (!updated) throw new Error('codex subscriber lost the entity')
          await indexedDbCodexEntityRepository.save(updated)
          resolve()
        })().catch(reject)
      })
      harness.scopedBus.on('CODEX_ENTITY_TOUCHED', (payload) => {
        codexEvents.push(payload.entityId)
      })
    })

    const analysis = waterMeterEngine.auditText(chapter.content)
    const mutation = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'text_replace',
      search: '众所周知，',
      replacement: '',
    })
    const persistedChapter = await persistActiveChapter(harness)
    await finished

    const storedChapter = (await indexedDbProjectRepository.getChaptersByProject(projectId)).find(
      (item) => item.id === chapter.id,
    )
    const storedEntity = (await indexedDbCodexEntityRepository.getAll()).find(
      (item) => item.id === entity.id,
    )
    const context = await provideLivingCodexContext({
      projectId,
      currentText: persistedChapter.content,
      activeChapterId: chapter.id,
    })

    expect(analysis.totalWordCount).toBeGreaterThan(20)
    expect(mutation.success).toBe(true)
    expect(mutation.currentRevision).toBe(2)
    expect(auditEvents).toEqual([
      { projectId, chapterId: chapter.id, wordCount: persistedChapter.content.length },
    ])
    expect(codexEvents).toEqual([entity.id])
    expect(storedChapter?.content).toBe(persistedChapter.content)
    expect(storedChapter?.revision).toBe(2)
    expect(storedEntity?.attributes.lastAuditWordCount).toBe(persistedChapter.content.length)
    expect(storedEntity?.attributes.lastAudit).toBe('water-meter')
    if (!context) throw new Error('living codex context was not returned')
    expect((context.data as { entities: Array<{ id: string }> }).entities).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: entity.id })]),
    )
  })

  it('TC-CROSS-02: Applies a drawer diff through CAS and persists the subscriber-completed review', async () => {
    const oldText = '楚凌霄在雨中踏入古城。\n黑云压城，远处雷声滚动。'
    const proposedText = '楚凌霄在雨中踏入古城。\n黑云压城，远处雷声如战鼓。'
    const chapter = makeChapter(projectId, oldText)
    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    await indexedDbProjectRepository.saveChapter(chapter)

    const diff = DiffReviewerEngine.computeDiff(oldText, proposedText)
    const reviewId = `${projectId}::review-1`
    const review: DiffReviewRecord = {
      id: reviewId,
      projectId,
      chapterId: chapter.id,
      title: '跨功能差异审校',
      sourceText: oldText,
      proposedText,
      hunks: diff.hunks.map((hunk) => ({
        id: hunk.id,
        oldStartLine: hunk.oldStartLine,
        oldLineCount: hunk.oldLineCount,
        newStartLine: hunk.newStartLine,
        newLineCount: hunk.newLineCount,
        lines: [...hunk.lines],
        resolution: 'pending',
      })),
      status: 'open',
      summaryStats: diff.stats,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await indexedDbDiffReviewRepository.save(review)

    const reviewFinished = new Promise<void>((resolve, reject) => {
      harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
        void (async () => {
          const current = await indexedDbDiffReviewRepository.get(reviewId)
          if (!current) throw new Error('review disappeared before subscriber update')
          await indexedDbDiffReviewRepository.save({
            ...current,
            status: 'completed',
            hunks: current.hunks.map((hunk) => ({ ...hunk, resolution: 'applied' })),
            updatedAt: Date.now(),
          })
          expect(payload.wordCount).toBe(proposedText.length)
          resolve()
        })().catch(reject)
      })
    })

    const merged = DiffReviewerEngine.applyHunks(
      oldText,
      diff.hunks.map((hunk) => ({
        lines: hunk.lines,
        oldStartLine: hunk.oldStartLine,
        resolution: 'applied' as const,
      })),
    )
    const mutation = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: merged,
    })
    const persistedChapter = await persistActiveChapter(harness)
    await reviewFinished

    const persistedReview = await indexedDbDiffReviewRepository.get(reviewId)
    expect(diff.hunks.length).toBeGreaterThan(0)
    expect(merged).toBe(proposedText)
    expect(mutation.success).toBe(true)
    expect(persistedChapter.content).toBe(proposedText)
    expect(persistedReview?.status).toBe('completed')
    expect(persistedReview?.hunks.every((hunk) => hunk.resolution === 'applied')).toBe(true)
    expect((await indexedDbProjectRepository.getChaptersByProject(projectId))[0].revision).toBe(2)
  })

  it('TC-CROSS-03: Routes a combat breach event into a persisted Living Codex update and CAS note', async () => {
    const chapter = makeChapter(projectId, '楚凌霄在城门前迎战高阶敌手。')
    const entity = makeEntity(projectId)
    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(entity)
    await indexedDbProjectRepository.saveChapter(chapter)
    await indexedDbCodexEntityRepository.save(entity)

    const powerEvents: Array<{ tierDiff: number; riskLevel: string }> = []
    const codexEvents: string[] = []
    const finished = new Promise<void>((resolve, reject) => {
      harness.scopedBus.on('POWER_BREACH_DETECTED', (payload) => {
        powerEvents.push(payload)
        void (async () => {
          await harness.mutateCodexEntity(entity.id, (previous) => ({
            attributes: {
              ...previous.attributes,
              powerRisk: payload.riskLevel,
              lastTierDiff: payload.tierDiff,
            },
          }))
          const updated = harness.getCodexEntity(entity.id)
          if (!updated) throw new Error('combat subscriber lost the entity')
          await indexedDbCodexEntityRepository.save(updated)
          resolve()
        })().catch(reject)
      })
      harness.scopedBus.on('CODEX_ENTITY_TOUCHED', (payload) => {
        codexEvents.push(payload.entityId)
      })
    })

    const alert = CombatSandboxEngine.auditPowerBreach({
      projectId,
      protagonistRank: 10,
      enemyRank: 40,
      compensatoryAssets: [],
      protagonistName: entity.name,
      enemyName: '黑煞魔尊',
    })
    const template = CombatSandboxEngine.generateFourPhaseTemplate(entity.name, '黑煞魔尊')
    const duel: CombatDuelRecord = {
      id: `${projectId}::duel-1`,
      projectId,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      protagonistName: entity.name,
      protagonistTier: '筑基期',
      protagonistRankValue: 10,
      enemyName: '黑煞魔尊',
      enemyTier: '化神期',
      enemyRankValue: 40,
      stakes: '守住城门',
      beats: template.beats,
      compensatoryAssets: [],
      breachAudit: alert,
      updatedAt: Date.now(),
    }
    await indexedDbCombatSandboxRepository.save(duel)
    await finished

    const mutation = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: `${chapter.content}\n战力审计：${alert.riskLevel}。`,
    })
    const persistedChapter = await persistActiveChapter(harness)
    const storedDuel = await indexedDbCombatSandboxRepository.get(duel.id)
    const storedEntity = (await indexedDbCodexEntityRepository.getAll()).find(
      (item) => item.id === entity.id,
    )

    expect(alert.isBreached).toBe(true)
    expect(powerEvents).toEqual([
      expect.objectContaining({ projectId, tierDiff: 30, riskLevel: 'CRITICAL_COLLAPSE' }),
    ])
    expect(codexEvents).toEqual([entity.id])
    expect(storedDuel?.breachAudit.riskLevel).toBe(alert.riskLevel)
    expect(storedEntity?.attributes.powerRisk).toBe('CRITICAL_COLLAPSE')
    expect(storedEntity?.attributes.lastTierDiff).toBe(30)
    expect(mutation.success).toBe(true)
    expect(persistedChapter.content).toContain('战力审计：CRITICAL_COLLAPSE')
    expect(persistedChapter.revision).toBe(2)
  })

  it('TC-CROSS-04: Synchronizes calendar conversion, causal order, event delivery, and codex state', async () => {
    const chapter = makeChapter(projectId, '时间线同步前的章节草稿。')
    const entity = makeEntity(projectId)
    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(entity)
    await indexedDbProjectRepository.saveChapter(chapter)
    await indexedDbCodexEntityRepository.save(entity)

    const [ancient, dynasty] = MultiCalendarEngine.DEFAULT_CALENDARS
    const sourceDate = { year: 1001, month: 1, day: 1 }
    const conversion = MultiCalendarEngine.convertCalendarDate({
      sourceCalendar: ancient,
      targetCalendar: dynasty,
      sourceDate,
    })
    const chronologyEvents: ChapterChronologyEvent[] = [
      {
        chapterId: `${projectId}::chapter-0`,
        chapterOrder: 1,
        chapterTitle: '纪元交接',
        timePoint: {
          calendarId: ancient.id,
          ...sourceDate,
          absoluteDayIndex: conversion.absoluteDayIndex - 1,
        },
        eventSummary: '旧历最后一日',
      },
      {
        chapterId: chapter.id,
        chapterOrder: 2,
        chapterTitle: chapter.title,
        timePoint: {
          calendarId: dynasty.id,
          ...conversion.targetDate,
          absoluteDayIndex: conversion.absoluteDayIndex,
        },
        eventSummary: '新历第一日',
      },
    ]
    const thread: NarrativeThread = {
      id: `${projectId}::thread-main`,
      projectId,
      name: '主线因果',
      color: '#334155',
      characterIds: [entity.id],
      order: 1,
    }
    const nodes: TimelineNode[] = [
      {
        id: `${projectId}::node-1`,
        projectId,
        threadId: thread.id,
        chapterOrder: 1,
        eventTitle: '旧历终结',
        summary: '纪元转换前置事件',
        status: 'completed',
        prerequisites: [],
        causalOutcome: '进入新历',
        relatedEntityIds: [entity.id],
        emotionalPolarity: -0.1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: `${projectId}::node-2`,
        projectId,
        threadId: thread.id,
        chapterOrder: 2,
        eventTitle: '新历启幕',
        summary: '新历第一日的事件',
        status: 'planned',
        prerequisites: [`${projectId}::node-1`],
        causalOutcome: '时间线继续',
        relatedEntityIds: [entity.id],
        emotionalPolarity: 0.2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]
    const calendarRecord: MultiCalendarProjectRecord = {
      id: `${projectId}::calendars`,
      projectId,
      calendars: [ancient, dynasty],
      chronologyEvents,
      updatedAt: Date.now(),
    }
    await indexedDbMultiCalendarRepository.save(calendarRecord)
    await indexedDbTimelineRepository.saveThread(thread)
    for (const node of nodes) await indexedDbTimelineRepository.saveNode(node)

    const chronologyAudit = MultiCalendarEngine.validateChronology(chronologyEvents)
    const causalAudit = causalEngine.auditAllConflicts(nodes)
    const timelineEvents: number[] = []
    const finished = new Promise<void>((resolve, reject) => {
      harness.scopedBus.on('TIMELINE_EVENT_REGISTERED', (payload) => {
        timelineEvents.push(payload.universalAbsoluteDay)
        void (async () => {
          await harness.mutateCodexEntity(entity.id, (previous) => ({
            attributes: {
              ...previous.attributes,
              lastTimelineDay: payload.universalAbsoluteDay,
            },
          }))
          const updated = harness.getCodexEntity(entity.id)
          if (!updated) throw new Error('timeline subscriber lost the entity')
          await indexedDbCodexEntityRepository.save(updated)
          resolve()
        })().catch(reject)
      })
    })

    harness.scopedBus.emit('TIMELINE_EVENT_REGISTERED', {
      projectId,
      chapterId: chapter.id,
      calendarId: dynasty.id,
      universalAbsoluteDay: conversion.absoluteDayIndex,
      summary: '新历第一日已登记',
    })
    await finished
    const mutation = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: `时间线已同步至大炎皇统历${conversion.targetDate.year}年${conversion.targetDate.month}月${conversion.targetDate.day}日。`,
    })
    const persistedChapter = await persistActiveChapter(harness)
    const storedCalendar = await indexedDbMultiCalendarRepository.get(projectId)
    const storedNodes = (await indexedDbTimelineRepository.getAllNodes()).filter(
      (node) => node.projectId === projectId,
    )
    const storedEntity = (await indexedDbCodexEntityRepository.getAll()).find(
      (item) => item.id === entity.id,
    )

    expect(conversion.targetDate).toEqual({ year: 1, month: 1, day: 1 })
    expect(chronologyAudit.hasParadox).toBe(false)
    expect(causalAudit).toHaveLength(0)
    expect(timelineEvents).toEqual([conversion.absoluteDayIndex])
    expect(storedCalendar?.chronologyEvents[1].timePoint.absoluteDayIndex).toBe(
      conversion.absoluteDayIndex,
    )
    expect(storedNodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(nodes.map((node) => node.id)),
    )
    expect(storedEntity?.attributes.lastTimelineDay).toBe(conversion.absoluteDayIndex)
    expect(mutation.success).toBe(true)
    expect(persistedChapter.revision).toBe(2)
  })

  it('TC-CROSS-05: Persists unified chapter evaluation and applies its event-driven codex update', async () => {
    const chapter = makeChapter(
      projectId,
      '初稿中楚凌霄被围攻，陷入绝境。雷声轰鸣，敌人冷笑逼近，门后的真相竟是另一场危机。',
    )
    const entity = makeEntity(projectId)
    const harness = new TestHostHarness(projectId)
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(entity)
    await indexedDbProjectRepository.saveChapter(chapter)
    await indexedDbCodexEntityRepository.save(entity)

    const events: Array<{ chapterId: string; compositeScore: number; pacingRating: string }> = []
    const finished = new Promise<void>((resolve, reject) => {
      harness.scopedBus.on('UNIFIED_CHAPTER_EVALUATED', (payload) => {
        events.push(payload)
        void (async () => {
          const audit: EmotionAuditRecord = {
            id: `${projectId}::emotion-1`,
            projectId,
            chapterId: payload.chapterId,
            chapterTitle: chapter.title,
            chapterOrder: chapter.order,
            wordCount: chapter.wordCount,
            vector: {
              tension: payload.compositeScore,
              catharsis: payload.cliffhangerScore,
              frustration: Math.max(0, 100 - payload.compositeScore),
              anticipation: payload.cliffhangerScore,
              sorrow: 0,
              joy: payload.compositeScore,
            },
            netPolarity: payload.compositeScore - 50,
            dominantEmotion: 'tension',
            resonanceScore: payload.compositeScore,
            warnings: [],
            suggestions: [],
            updatedAt: Date.now(),
          }
          await indexedDbEmotionAuditRepository.save(audit)
          await harness.mutateCodexEntity(entity.id, (previous) => ({
            attributes: {
              ...previous.attributes,
              lastCompositeScore: payload.compositeScore,
              pacingRating: payload.pacingRating,
            },
          }))
          const updated = harness.getCodexEntity(entity.id)
          if (!updated) throw new Error('quality subscriber lost the entity')
          await indexedDbCodexEntityRepository.save(updated)
          resolve()
        })().catch(reject)
      })
    })

    const result = ChapterQualityEvaluator.evaluateChapter({
      projectId,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterOrder: chapter.order,
      content: chapter.content,
    })
    await finished
    const mutation = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'text_replace',
      search: '初稿',
      replacement: '定稿',
    })
    const persistedChapter = await persistActiveChapter(harness)
    const storedAudit = await indexedDbEmotionAuditRepository.getByChapterId(chapter.id)
    const storedEntity = (await indexedDbCodexEntityRepository.getAll()).find(
      (item) => item.id === entity.id,
    )

    expect(events).toEqual([
      expect.objectContaining({ chapterId: chapter.id, compositeScore: result.compositeScore }),
    ])
    expect(storedAudit?.vector.tension).toBe(result.compositeScore)
    expect(storedAudit?.chapterId).toBe(chapter.id)
    expect(storedEntity?.attributes.lastCompositeScore).toBe(result.compositeScore)
    expect(storedEntity?.attributes.pacingRating).toBe(result.pacingRating)
    expect(mutation.success).toBe(true)
    expect(persistedChapter.content).toContain('定稿')
    expect(persistedChapter.revision).toBe(2)
  })
})
