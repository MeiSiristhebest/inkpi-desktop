// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexedDbAftermathRepository } from '../../../src/adapters/indexedDbAftermathRepository'
import { pluginEventBus, type PluginEventPayloads } from '../../../src/core/pluginEventBus'
import type { ChapterRecord } from '../../../src/types'
import { AftermathEngine } from '../../../src/plugins/aftermath-sync/engine/AftermathEngine'
import type { AftermathPatchRecord } from '../../../src/ports/aftermathRepository'
import { DiffReviewerEngine } from '../../../src/plugins/diff-reviewer/engine/DiffReviewerEngine'
import { NarrativeLinterEngine } from '../../../src/plugins/narrative-linter/engine/NarrativeLinterEngine'
import { SafeGateEngine } from '../../../src/plugins/safe-gate/engine/SafeGateEngine'
import type { RegexRule, SensitiveWord } from '../../../src/plugins/safe-gate/types'
import seedWordsBlue from '../../../src/plugins/safe-gate/data/seed-words-blue.json'
import seedWordsRed from '../../../src/plugins/safe-gate/data/seed-words-red.json'
import seedWordsYellow from '../../../src/plugins/safe-gate/data/seed-words-yellow.json'
import regexRules from '../../../src/plugins/safe-gate/data/regex-rules.json'
import { waterMeterEngine } from '../../../src/plugins/water-meter/engine/WaterMeterEngine'
import type { CodexEntity } from '../../../src/plugins/living-codex/types'
import { TestHostHarness } from '../harness'

function createChapterFixture(initialContent: string) {
  const projectId = `test-proj-${crypto.randomUUID()}`
  const chapterId = `test-chapter-${crypto.randomUUID()}`
  const now = Date.now()
  const chapter: ChapterRecord = {
    id: chapterId,
    projectId,
    volumeId: `${projectId}-volume-1`,
    title: '物理回写测试章',
    content: initialContent,
    wordCount: initialContent.length,
    order: 1,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
  const harness = new TestHostHarness(projectId, 'Physical Writeback E2E Book')
  harness.setActiveChapter(chapter)
  harness.setHierarchy([], [chapter])
  return { harness, projectId, chapterId }
}

describe('Tier 1: F7-F10 - Physical Writeback', () => {
  let persistedAftermathPatchIds: string[] = []

  beforeEach(() => {
    pluginEventBus.clear()
    persistedAftermathPatchIds = []
  })

  afterEach(async () => {
    for (const patchId of persistedAftermathPatchIds) {
      await indexedDbAftermathRepository.delete(patchId)
    }
    pluginEventBus.clear()
  })

  it('TC-WRITE-01: applies an AftermathEngine entity patch through the host and persists its decision', async () => {
    const { harness, projectId, chapterId } = createChapterFixture(
      '林凡在闭关后气息暴涨，一举迈入金丹初期！',
    )
    const now = Date.now()
    const entity: CodexEntity = {
      id: `${projectId}::character-lin-fan`,
      projectId,
      name: '林凡',
      aliases: [],
      category: 'character',
      attributes: { 战力境界: '练气九层' },
      relations: [],
      summary: '主角林凡',
      createdAt: now,
      updatedAt: now,
    }
    harness.setCodexEntity(entity)

    const touched: Array<PluginEventPayloads['CODEX_ENTITY_TOUCHED']> = []
    const unsubscribe = harness.scopedBus.on('CODEX_ENTITY_TOUCHED', (payload) => {
      touched.push(payload)
    })

    const analysis = AftermathEngine.analyzeChapter(
      '林凡在闭关后气息暴涨，一举迈入金丹初期！',
      chapterId,
      1,
      [
        {
          id: entity.id,
          name: entity.name,
          category: 'character',
          currentTier: '练气九层',
        },
      ],
    )

    expect(analysis.summary.attributeUpdates).toBe(1)
    expect(analysis.patches).toHaveLength(1)
    const patch = analysis.patches[0]!
    const patchId = `${projectId}::aftermath-patch-1`
    const pendingRecord: AftermathPatchRecord = {
      ...patch,
      id: patchId,
      projectId,
      status: 'pending',
      createdAt: Date.now(),
    }
    persistedAftermathPatchIds.push(patchId)
    await indexedDbAftermathRepository.save(pendingRecord)
    expect(await indexedDbAftermathRepository.get(patchId)).toEqual(pendingRecord)

    const changeNote = `[设定变更] ${patch.propertyName}: ${patch.beforeValue} -> ${patch.afterValue}`
    await harness.mutateCodexEntity(entity.id, (previous) => ({
      attributes: {
        ...previous.attributes,
        [patch.propertyName]: patch.afterValue,
      },
      detailMarkdown: changeNote,
      summary: `${previous.summary} (${patch.propertyName}:${patch.afterValue})`,
    }))

    const updatedEntity = harness.getCodexEntity(entity.id)
    expect(updatedEntity?.attributes[patch.propertyName]).toBe('金丹初期')
    expect(updatedEntity?.detailMarkdown).toContain(changeNote)
    expect(updatedEntity?.summary).toContain('金丹初期')
    expect(touched).toEqual([
      {
        projectId,
        entityId: entity.id,
        entityName: entity.name,
        category: 'character',
      },
    ])

    const appliedAt = Date.now()
    await indexedDbAftermathRepository.save({
      ...pendingRecord,
      status: 'applied',
      appliedAt,
    })
    expect(await indexedDbAftermathRepository.get(patchId)).toMatchObject({
      status: 'applied',
      entityId: entity.id,
      afterValue: '金丹初期',
      appliedAt,
    })

    unsubscribe()
  })

  it('TC-WRITE-02: commits a real DiffReviewer merge through CAS and updates the hierarchy', async () => {
    const original = `第1章 惊变
林凡握住生锈的铁剑，冷冷看着面前的黑衣人。
天空中下着暴雨，电闪雷鸣。
黑衣人冷笑一声，拔出腰间的短刀。`
    const proposed = `第1章 惊变
林凡紧握着古朴的青铜断剑，眸光如冰注视着前方的刺客。
天空中暴雨倾盆，雷光划破夜幕。
黑衣人狞笑一声，拔出腰间的短刀。`
    const { harness, chapterId, projectId } = createChapterFixture(original)
    const audited: Array<PluginEventPayloads['CHAPTER_CONTENT_AUDITED']> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })

    const diff = DiffReviewerEngine.computeDiff(original, proposed)
    expect(diff.hunks.length).toBeGreaterThan(0)
    expect(diff.stats.additions).toBeGreaterThan(0)
    expect(diff.stats.deletions).toBeGreaterThan(0)
    const merged = DiffReviewerEngine.applyHunks(
      original,
      diff.hunks.map((hunk) => ({
        lines: hunk.lines,
        oldStartLine: hunk.oldStartLine,
        resolution: 'applied' as const,
      })),
    )
    expect(merged).toBe(proposed)

    const writeback = await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: merged,
    })

    expect(writeback).toMatchObject({
      success: true,
      conflict: false,
      currentRevision: 2,
      updatedContent: proposed,
    })
    expect(harness.activeChapter?.content).toBe(proposed)
    expect(harness.bookHierarchy.chapters[0]?.content).toBe(proposed)
    expect(audited).toEqual([
      {
        projectId,
        chapterId,
        wordCount: proposed.length,
      },
    ])

    unsubscribe()
  })

  it('TC-WRITE-03: rejects a stale DiffReviewer CAS commit without changing text or emitting a second event', async () => {
    const original = '林凡拔剑挡在石门前。'
    const { harness, chapterId, projectId } = createChapterFixture(original)
    const audited: Array<PluginEventPayloads['CHAPTER_CONTENT_AUDITED']> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })
    const firstRevisionContent = '林凡拔剑挡在裂开的石门前。'
    const staleContent = '林凡拔剑挡在已经坍塌的石门前。'

    const firstWrite = await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: firstRevisionContent,
    })
    const staleWrite = await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: staleContent,
    })

    expect(firstWrite).toMatchObject({ success: true, currentRevision: 2 })
    expect(staleWrite).toMatchObject({
      success: false,
      conflict: true,
      currentRevision: 2,
    })
    expect(staleWrite.error).toContain('CAS Conflict')
    expect(harness.activeChapter?.content).toBe(firstRevisionContent)
    expect(harness.bookHierarchy.chapters[0]?.content).toBe(firstRevisionContent)
    expect(audited).toHaveLength(1)
    expect(audited[0]).toMatchObject({
      projectId,
      chapterId,
      wordCount: firstRevisionContent.length,
    })

    unsubscribe()
  })

  it('TC-WRITE-04: writes WaterMeter cleanup output to the active chapter and preserves the audit event', async () => {
    const initialText =
      '众所周知，林凡忍不住拔剑，暗暗心惊，随后拔剑斩向黑衣人，剑光撕裂长街。'
    const { harness, projectId, chapterId } = createChapterFixture(initialText)
    const audited: Array<PluginEventPayloads['CHAPTER_CONTENT_AUDITED']> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })

    const report = waterMeterEngine.auditText(initialText, { projectId, chapterId })
    expect(report.totalWordCount).toBeGreaterThan(20)
    expect(report.bloatItems.map((item) => item.text)).toEqual(
      expect.arrayContaining(['众所周知', '忍不住', '暗暗心惊']),
    )
    expect(audited).toHaveLength(1)
    expect(audited[0]).toMatchObject({
      projectId,
      chapterId,
      wordCount: report.totalWordCount,
      waterScore: report.waterScore,
    })

    const cleanedText = report.bloatItems
      .reduce((text, item) => text.replaceAll(item.text, ''), initialText)
      .replace(/\n\s*\n/g, '\n')
      .trim()
    const writeback = await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: cleanedText,
    })

    expect(writeback.success).toBe(true)
    expect(writeback.updatedContent).toBe(cleanedText)
    expect(harness.activeChapter?.content).toBe(cleanedText)
    expect(cleanedText).not.toContain('众所周知')
    expect(cleanedText).not.toContain('忍不住')
    expect(cleanedText).not.toContain('暗暗心惊')
    expect(audited).toHaveLength(2)
    expect(audited[1]).toMatchObject({
      projectId,
      chapterId,
      wordCount: cleanedText.length,
    })

    unsubscribe()
  })

  it('TC-WRITE-05: writes SafeGate production seed replacements to the active chapter', async () => {
    const initialText = '林凡踏入战场，血肉横飞，政府与公安局的飞舟赶到长街尽头。'
    const { harness, chapterId, projectId } = createChapterFixture(initialText)
    const engine = new SafeGateEngine()
    engine.build(
      [
        ...(seedWordsRed as SensitiveWord[]),
        ...(seedWordsYellow as SensitiveWord[]),
        ...(seedWordsBlue as SensitiveWord[]),
      ],
      regexRules as RegexRule[],
    )

    const scan = engine.scan(initialText, 'xianxia')
    expect(scan.isClean).toBe(false)
    expect(scan.violations).toHaveLength(3)
    expect(scan.violations.map((violation) => violation.matchedText)).toEqual(
      expect.arrayContaining(['血肉横飞', '政府', '公安局']),
    )
    const replacedText = engine.applyAllAuto(initialText, scan, 'xianxia')
    expect(replacedText).toContain('死伤枕藉')
    expect(replacedText).toContain('仙盟执事堂')
    expect(replacedText).toContain('刑狱司')
    expect(replacedText).not.toContain('血肉横飞')
    expect(replacedText).not.toContain('政府')
    expect(replacedText).not.toContain('公安局')

    const audited: Array<PluginEventPayloads['CHAPTER_CONTENT_AUDITED']> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })
    const writeback = await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: replacedText,
    })

    expect(writeback).toMatchObject({
      success: true,
      currentRevision: 2,
      updatedContent: replacedText,
    })
    expect(harness.activeChapter?.content).toBe(replacedText)
    expect(audited).toEqual([
      {
        projectId,
        chapterId,
        wordCount: replacedText.length,
      },
    ])

    unsubscribe()
  })

  it('TC-WRITE-06: writes a NarrativeLinter quick fix and verifies the repaired text is physically present', async () => {
    const initialText = '林凡狠狠地咬牙，愤怒地拔剑，快速地朝敌人斩去。'
    const { harness, chapterId, projectId } = createChapterFixture(initialText)
    const engine = new NarrativeLinterEngine()
    const initialReport = engine.lint(initialText)
    expect(initialReport.warningCount).toBe(3)
    const issue = initialReport.issues.find(
      (candidate) => candidate.ruleId === 'LINT_ADVERB_STACK' && candidate.quickFix,
    )
    expect(issue).toBeDefined()
    if (!issue?.quickFix) {
      throw new Error('Expected the production linter to provide a quick fix')
    }

    const fixedText = NarrativeLinterEngine.applyQuickFix(initialText, issue)
    const fixedReport = engine.lint(fixedText)
    expect(fixedText).not.toContain(issue.matchedSnippet)
    expect(fixedReport.warningCount).toBe(0)
    expect(fixedReport.cleanScore).toBeGreaterThan(initialReport.cleanScore)

    const audited: Array<PluginEventPayloads['CHAPTER_CONTENT_AUDITED']> = []
    const unsubscribe = harness.scopedBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
      audited.push(payload)
    })
    const writeback = await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: fixedText,
    })

    expect(writeback.success).toBe(true)
    expect(harness.activeChapter?.content).toBe(fixedText)
    expect(harness.activeChapter?.content).not.toContain(issue.matchedSnippet)
    expect(audited).toEqual([
      {
        projectId,
        chapterId,
        wordCount: fixedText.length,
      },
    ])

    unsubscribe()
  })
})
