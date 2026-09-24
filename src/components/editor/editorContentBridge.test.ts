import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChapterRecord } from '../../types'
import type { ChapterMutationExecutionResult } from '../../services/chapterMutationService'

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock('../../services/defaultChapterMutationService', () => ({
  chapterMutationService: { mutate },
}))

import { applyContentMutation } from './editorContentBridge'
import { draftJournal } from '../../services/draftJournal'

function chapter(overrides: Partial<ChapterRecord> = {}): ChapterRecord {
  return {
    id: 'ch-1',
    projectId: 'ws-1',
    volumeId: 'v-1',
    title: '第001章',
    content: 'durable content',
    wordCount: 16,
    order: 1,
    revision: 3,
    updatedAt: 1000,
    ...overrides,
  }
}

function ok(next: ChapterRecord): ChapterMutationExecutionResult {
  return {
    success: true,
    conflict: false,
    previousRevision: next.revision - 1,
    newRevision: next.revision,
    chapter: next,
    wordCountDelta: 0,
  }
}

const OPTIONS = {
  workspaceId: 'ws-1',
  chapterId: 'ch-1',
  expectedRevision: 3,
  origin: 'format' as const,
}

beforeEach(() => {
  mutate.mockReset()
  localStorage.clear()
})

describe('applyContentMutation', () => {
  it('writes through the single authoritative channel and mirrors the result into the editor', async () => {
    mutate.mockResolvedValue(ok(chapter({ content: 'formatted', revision: 4 })))

    const result = await applyContentMutation(null, 'formatted', OPTIONS)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      chapterId: 'ch-1',
      expectedRevision: 3,
      mutation: { type: 'replace-content', content: 'formatted' },
      origin: 'format',
      countAsAuthorWriting: undefined,
      createHistorySnapshot: undefined,
      triggerContinuityAudit: undefined,
    })
    expect(result?.content).toBe('formatted')
  })

  it('drains an unpersisted draft into the channel before replacing content', async () => {
    draftJournal.record({
      workspaceId: 'ws-1',
      chapterId: 'ch-1',
      baseRevision: 3,
      editorContent: 'unsaved typing that never reached the database',
      updatedAt: 1500,
    })
    mutate
      .mockResolvedValueOnce(
        ok(chapter({ content: 'unsaved typing that never reached the database', revision: 4 })),
      )
      .mockResolvedValueOnce(ok(chapter({ content: 'formatted', revision: 5 })))

    await applyContentMutation(null, 'formatted', OPTIONS)

    expect(mutate).toHaveBeenCalledTimes(2)
    const [[drain], [replace]] = mutate.mock.calls
    expect(drain.mutation).toEqual({
      type: 'replace-content',
      content: 'unsaved typing that never reached the database',
    })
    expect(drain.expectedRevision).toBe(3)
    expect(replace.mutation).toEqual({ type: 'replace-content', content: 'formatted' })
    // The replace must land on the revision the drain produced, not the caller's stale one.
    expect(replace.expectedRevision).toBe(4)
  })

  it('fails closed instead of overwriting an unpersisted draft it cannot recover', async () => {
    draftJournal.record({
      workspaceId: 'ws-1',
      chapterId: 'ch-1',
      baseRevision: 2,
      editorContent: 'unsaved typing',
      updatedAt: 1500,
    })
    mutate.mockResolvedValue({
      success: false,
      conflict: true,
      currentRevision: 3,
      error: 'CAS Conflict',
    })

    const result = await applyContentMutation(null, 'formatted', OPTIONS)

    expect(result).toBeNull()
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('skips the drain when the replacement already contains the journaled text', async () => {
    draftJournal.record({
      workspaceId: 'ws-1',
      chapterId: 'ch-1',
      baseRevision: 3,
      editorContent: 'formatted',
      updatedAt: 1500,
    })
    mutate.mockResolvedValue(ok(chapter({ content: 'formatted', revision: 4 })))

    await applyContentMutation(null, 'formatted', OPTIONS)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0].expectedRevision).toBe(3)
  })

  it('reports a rejected mutation instead of claiming success', async () => {
    mutate.mockResolvedValue({ success: false, conflict: false, error: 'Chapter not found' })

    await expect(applyContentMutation(null, 'formatted', OPTIONS)).resolves.toBeNull()
  })
})
