// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pluginEventBus, type PluginEventPayloads } from '../../../src/core/pluginEventBus'
import { AftermathEngine } from '../../../src/plugins/aftermath-sync/engine/AftermathEngine'
import { CombatSandboxEngine } from '../../../src/plugins/combat-sandbox/engine/CombatSandboxEngine'
import { MultiCalendarEngine } from '../../../src/plugins/multi-calendar/engine/MultiCalendarEngine'
import { causalEngine } from '../../../src/plugins/timeline-grid/engine/CausalEngine'
import { DiffReviewerEngine } from '../../../src/plugins/diff-reviewer/engine/DiffReviewerEngine'
import type { CodexEntity } from '../../../src/plugins/living-codex/types'
import type { ChapterRecord } from '../../../src/types'
import { TestHostHarness } from '../harness'

function makeChapter(projectId: string, content: string): ChapterRecord {
  const now = Date.now()
  return {
    id: `${projectId}::chapter-1`,
    projectId,
    volumeId: `${projectId}::volume-1`,
    title: '长篇写作场景章节',
    content,
    wordCount: content.length,
    order: 1,
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
}

function makeEntity(projectId: string, name: string): CodexEntity {
  const now = Date.now()
  return {
    id: `${projectId}::entity-hero`,
    projectId,
    name,
    aliases: [],
    category: 'character',
    attributes: { realm: '练气九层' },
    relations: [],
    summary: `${name} 的长篇主角设定`,
    createdAt: now,
    updatedAt: now,
  }
}

describe('Tier 4: Novel writing scenarios', () => {
  let projectId = ''

  beforeEach(() => {
    projectId = `test-proj-${crypto.randomUUID()}`
    pluginEventBus.clear()
  })

  afterEach(() => {
    pluginEventBus.clear()
  })

  it('TC-NOVEL-01: Completes a cultivation breakthrough from analysis to codex and prose', async () => {
    const protagonist = makeEntity(projectId, '林凡')
    const chapter = makeChapter(projectId, '林凡在闭关中稳住心神，灵气沿经脉缓缓流转。')
    const harness = new TestHostHarness(projectId, '修行长篇')
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(protagonist)
    const touched: string[] = []
    const unsubscribe = harness.scopedBus.on('CODEX_ENTITY_TOUCHED', (payload) => {
      touched.push(payload.entityId)
    })

    const analysis = AftermathEngine.analyzeChapter(
      `${chapter.content} 林凡终于踏入金丹初期。`,
      chapter.id,
      chapter.revision,
      [{ id: protagonist.id, name: protagonist.name, category: 'character', currentTier: '练气九层' }],
    )
    expect(analysis.summary.attributeUpdates).toBe(1)
    const patch = analysis.patches[0]
    expect(patch?.afterValue).toBe('金丹初期')

    await harness.mutateCodexEntity(protagonist.id, (previous) => ({
      attributes: { ...previous.attributes, [patch!.propertyName]: patch!.afterValue },
      summary: `${previous.summary}，已突破至${patch!.afterValue}`,
    }))
    const writeback = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: `${chapter.content}\n林凡终于踏入金丹初期。`,
    })

    expect(writeback).toMatchObject({ success: true, currentRevision: 2 })
    expect(harness.getCodexEntity(protagonist.id)?.attributes[patch!.propertyName]).toBe('金丹初期')
    expect(harness.activeChapter?.content).toContain('金丹初期')
    expect(touched).toEqual([protagonist.id])
    unsubscribe()
  })

  it('TC-NOVEL-02: Records a combat breach alert before committing its consequence to the chapter', async () => {
    const protagonist = makeEntity(projectId, '楚凌霄')
    const chapter = makeChapter(projectId, '楚凌霄守在城门前，敌人的威压如山岳压下。')
    const harness = new TestHostHarness(projectId, '战斗长篇')
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(protagonist)
    const alerts: Array<PluginEventPayloads['POWER_BREACH_DETECTED']> = []
    const unsubscribe = harness.scopedBus.on('POWER_BREACH_DETECTED', (payload) => {
      alerts.push(payload)
    })

    const breach = CombatSandboxEngine.auditPowerBreach({
      projectId,
      protagonistRank: 10,
      enemyRank: 40,
      compensatoryAssets: [],
      protagonistName: protagonist.name,
      enemyName: '黑煞魔尊',
    })
    expect(breach).toMatchObject({ isBreached: true, riskLevel: 'CRITICAL_COLLAPSE' })
    expect(alerts).toEqual([
      expect.objectContaining({ projectId, tierDiff: 30, riskLevel: 'CRITICAL_COLLAPSE' }),
    ])

    await harness.mutateCodexEntity(protagonist.id, (previous) => ({
      attributes: { ...previous.attributes, combatRisk: breach.riskLevel, enemyRank: 40 },
    }))
    const writeback = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: `${chapter.content}\n战力审计：${breach.riskLevel}，必须付出代价。`,
    })

    expect(writeback.success).toBe(true)
    expect(harness.getCodexEntity(protagonist.id)?.attributes.combatRisk).toBe('CRITICAL_COLLAPSE')
    expect(harness.activeChapter?.content).toContain('必须付出代价')
    unsubscribe()
  })

  it('TC-NOVEL-03: Synchronizes a calendar transition with causal ordering and story state', async () => {
    const protagonist = makeEntity(projectId, '沈月')
    const chapter = makeChapter(projectId, '旧历最后一夜过去，新历的第一缕日光照进城门。')
    const harness = new TestHostHarness(projectId, '时间线长篇')
    harness.setActiveChapter(chapter)
    harness.setCodexEntity(protagonist)
    const [ancient, dynasty] = MultiCalendarEngine.DEFAULT_CALENDARS
    const conversion = MultiCalendarEngine.convertCalendarDate({
      sourceCalendar: ancient,
      targetCalendar: dynasty,
      sourceDate: { year: 1001, month: 1, day: 1 },
    })
    const chronology = MultiCalendarEngine.validateChronology([
      {
        chapterId: `${projectId}::chapter-0`,
        chapterOrder: 0,
        chapterTitle: '旧历终结',
        timePoint: { calendarId: ancient.id, year: 1000, month: 12, day: 30, absoluteDayIndex: conversion.absoluteDayIndex - 1 },
        eventSummary: '旧历最后一日',
      },
      {
        chapterId: chapter.id,
        chapterOrder: chapter.order,
        chapterTitle: chapter.title,
        timePoint: { calendarId: dynasty.id, ...conversion.targetDate, absoluteDayIndex: conversion.absoluteDayIndex },
        eventSummary: '新历第一日',
      },
    ])
    const causal = causalEngine.auditAllConflicts([
      {
        id: `${projectId}::cause`,
        projectId,
        threadId: `${projectId}::thread`,
        chapterOrder: 1,
        eventTitle: '旧历终结',
        summary: '纪元转换前置事件',
        status: 'completed',
        prerequisites: [],
        causalOutcome: '进入新历',
        relatedEntityIds: [protagonist.id],
        emotionalPolarity: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])
    const timelineDays: number[] = []
    const unsubscribe = harness.scopedBus.on('TIMELINE_EVENT_REGISTERED', (payload) => {
      timelineDays.push(payload.universalAbsoluteDay)
    })
    harness.scopedBus.emit('TIMELINE_EVENT_REGISTERED', {
      projectId,
      chapterId: chapter.id,
      calendarId: dynasty.id,
      universalAbsoluteDay: conversion.absoluteDayIndex,
      summary: '新历第一日已登记',
    })
    await harness.mutateCodexEntity(protagonist.id, (previous) => ({
      attributes: { ...previous.attributes, timelineDay: conversion.absoluteDayIndex },
    }))

    expect(chronology.hasParadox).toBe(false)
    expect(causal).toHaveLength(0)
    expect(timelineDays).toEqual([conversion.absoluteDayIndex])
    expect(harness.getCodexEntity(protagonist.id)?.attributes.timelineDay).toBe(conversion.absoluteDayIndex)
    unsubscribe()
  })

  it('TC-NOVEL-04: Revises a chapter draft through a review, CAS commit, and stale-write rejection', async () => {
    const original = '她推开城门，听见远处传来钟声。'
    const revised = '她推开沉重的城门，远处的钟声在雾里一下一下地回荡。'
    const chapter = makeChapter(projectId, original)
    const harness = new TestHostHarness(projectId, '修订长篇')
    harness.setActiveChapter(chapter)
    const diff = DiffReviewerEngine.computeDiff(original, revised)
    expect(diff.hunks.length).toBeGreaterThan(0)
    const merged = DiffReviewerEngine.applyHunks(
      original,
      diff.hunks.map((hunk) => ({ lines: hunk.lines, oldStartLine: hunk.oldStartLine, resolution: 'applied' as const })),
    )
    const committed = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: merged,
    })
    const stale = await harness.mutateActiveChapter({
      chapterId: chapter.id,
      expectedRevision: 1,
      type: 'full_replace',
      content: original,
    })

    expect(merged).toBe(revised)
    expect(committed).toMatchObject({ success: true, currentRevision: 2, updatedContent: revised })
    expect(stale).toMatchObject({ success: false, conflict: true, currentRevision: 2 })
    expect(harness.activeChapter?.content).toBe(revised)
  })
})
