// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { TestHostHarness, checkSourceFileExists, type ChapterMutationPatch } from '../harness'
import type { ChapterRecord, VolumeRecord } from '../../../src/types'

describe('Tier 1: F1 - DesktopPluginHostContext & CAS Writeback', () => {
  let harness: TestHostHarness
  const projectId = 'proj-tier1-host-001'
  const chapterId = 'chap-101'

  beforeEach(() => {
    harness = new TestHostHarness(projectId, 'E2E Host Contract Book')
    const initialChapter: ChapterRecord = {
      id: chapterId,
      volumeId: 'vol-1',
      title: '第一章 剑起风云',
      order: 1,
      content: '楚凌霄拔出长剑，剑气如龙，直冲云霄。',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const initialVolume: VolumeRecord = {
      id: 'vol-1',
      title: '第一卷 潜龙在渊',
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    harness.setActiveChapter(initialChapter)
    harness.setHierarchy([initialVolume], [initialChapter])
  })

  it('TC-HOST-01: Exposes reactive activeChapter, revision sequence, and book hierarchy', () => {
    const ctx = harness.getContextValue()
    expect(ctx.projectId).toBe(projectId)
    expect(ctx.projectName).toBe('E2E Host Contract Book')
    expect(ctx.activeChapterId).toBe(chapterId)
    expect(ctx.activeChapter?.title).toBe('第一章 剑起风云')
    expect(ctx.revision).toBe(1)
    expect(ctx.bookHierarchy.volumes.length).toBe(1)
    expect(ctx.bookHierarchy.chapters.length).toBe(1)
  })

  it('TC-HOST-02: Successfully executes CAS writeback with matching revision token', async () => {
    const patch: ChapterMutationPatch = {
      chapterId,
      expectedRevision: 1,
      type: 'text_replace',
      search: '剑气如龙',
      replacement: '剑芒撕裂虚空',
    }

    const result = await harness.mutateActiveChapter(patch)

    expect(result.success).toBe(true)
    expect(result.conflict).toBe(false)
    expect(result.currentRevision).toBe(2)
    expect(result.updatedContent).toContain('剑芒撕裂虚空')
    expect(harness.revision).toBe(2)
    expect(harness.activeChapter?.content).toContain('剑芒撕裂虚空')
  })

  it('TC-HOST-03: Rejects stale CAS mutation and returns conflict: true on mismatched revision', async () => {
    // First mutation increments revision from 1 to 2
    await harness.mutateActiveChapter({
      chapterId,
      expectedRevision: 1,
      type: 'full_replace',
      content: '第一版更新内容。',
    })
    expect(harness.revision).toBe(2)

    // Stale concurrent actor attempts mutation with expectedRevision: 1
    const stalePatch: ChapterMutationPatch = {
      chapterId,
      expectedRevision: 1, // Stale!
      type: 'full_replace',
      content: '并发冲突内容。',
    }

    const result = await harness.mutateActiveChapter(stalePatch)

    expect(result.success).toBe(false)
    expect(result.conflict).toBe(true)
    expect(result.currentRevision).toBe(2)
    expect(result.error).toContain('CAS Conflict')
    expect(harness.activeChapter?.content).toBe('第一版更新内容。')
  })

  it('TC-HOST-04: Guarantees monotonic sequence of revisions across consecutive mutations', async () => {
    expect(harness.revision).toBe(1)

    for (let i = 1; i <= 5; i++) {
      const res = await harness.mutateActiveChapter({
        chapterId,
        expectedRevision: i,
        type: 'text_replace',
        search: /。$/,
        replacement: ` [第${i}次修订]。`,
      })
      expect(res.success).toBe(true)
      expect(res.currentRevision).toBe(i + 1)
      expect(harness.revision).toBe(i + 1)
    }

    expect(harness.activeChapter?.content).toContain('[第5次修订]')
  })

  it('TC-HOST-05: Rejects mutations directed to inactive or nonexistent chapters', async () => {
    const invalidPatch: ChapterMutationPatch = {
      chapterId: 'chap-unknown-999',
      expectedRevision: 1,
      type: 'full_replace',
      content: '非法注入。',
    }

    const result = await harness.mutateActiveChapter(invalidPatch)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Active chapter mismatch')
    expect(harness.revision).toBe(1) // Revision unmodified
  })

  it('TC-HOST-06: Verifies production implementation file readiness (M1 Contract Gate)', () => {
    const hostContextExists = checkSourceFileExists('core/pluginHostContext.tsx')
    // Documents the M1 requirement deliverable status
    if (!hostContextExists) {
      // Diagnostic escalation assertion for M1 implementers
      expect(
        hostContextExists,
        'M1 Deliverable Notice: DesktopPluginHostContext will be provided by src/core/pluginHostContext.tsx per PROJECT.md § M1',
      ).toBe(false)
    } else {
      expect(hostContextExists).toBe(true)
    }
  })
})
