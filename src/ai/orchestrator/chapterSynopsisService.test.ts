import { describe, expect, it, vi } from 'vitest'
import type { ChapterRecord } from '../../types'
import type { ChapterMutationService } from '../../services/chapterMutationService'
import { CREATIVE_ARTIFACT_TYPES } from '../artifacts'
import type { DistillationWorkflowResult, ProjectDistillationInput } from './verticalSlices'
import { chapterSynopsisDistillationInput, generateChapterSynopsis } from './chapterSynopsisService'

const chapter: ChapterRecord = {
  id: 'ch-1',
  projectId: 'proj-1',
  volumeId: 'vol-1',
  title: '第一章 启程',
  content: '<p>天地不仁，以万物为刍狗。</p>',
  wordCount: 11,
  order: 1,
  revision: 4,
  createdAt: 1000,
  updatedAt: 1000,
}

function workflow(summary: string): DistillationWorkflowResult {
  const facts = { summary, entities: [], events: [], promises: [] }
  return {
    facts,
    complete: true,
    failedChunks: [],
    completedChunks: 1,
    totalChunks: 1,
    checkpoint: {
      nextChunk: 1,
      completedChunkIndexes: [0],
      failedChunkIndexes: [],
      failedChunks: [],
      facts,
    },
    chunkTaskIds: ['chunk-0'],
  }
}

function mutationService(result: { success: true } | { success: false; conflict: boolean }) {
  const mutate = vi.fn(async () =>
    result.success
      ? {
          success: true as const,
          conflict: false as const,
          previousRevision: 4,
          newRevision: 5,
          chapter: { ...chapter, synopsis: '梗概' },
          wordCountDelta: 0,
        }
      : {
          success: false as const,
          conflict: true as const,
          currentRevision: 7,
          error: 'CAS Conflict: expected revision 4, but current revision is 7',
        },
  )
  return { service: { mutate } as unknown as ChapterMutationService, mutate }
}

describe('chapterSynopsisDistillationInput', () => {
  it('scopes one distillation task to the chapter and tags the chapter-summary artifact type', () => {
    const input = chapterSynopsisDistillationInput(chapter, 'proj-1')

    expect(input.documents).toHaveLength(1)
    expect(input.documents[0].documentId).toBe('ch-1')
    expect(input.documents[0].text).toBe('天地不仁，以万物为刍狗。')
    expect(input.target).toBe('document')
    expect(input.fields).toEqual(['summary'])
    expect(input.metadata).toEqual({ artifactType: CREATIVE_ARTIFACT_TYPES.chapterSummary })
  })

  it('derives a stable task id from the chapter revision so a retry reuses the same run', () => {
    const first = chapterSynopsisDistillationInput(chapter, 'proj-1').taskId
    const repeated = chapterSynopsisDistillationInput({ ...chapter }, 'proj-1').taskId
    const edited = chapterSynopsisDistillationInput({ ...chapter, revision: 5 }, 'proj-1').taskId

    expect(repeated).toBe(first)
    expect(edited).not.toBe(first)
  })
})

describe('generateChapterSynopsis', () => {
  it('writes the returned summary as the authoritative chapter synopsis attributed to the AI', async () => {
    const runDistillation = vi.fn(async () => workflow('主角在废墟中立誓离乡。'))
    const { service, mutate } = mutationService({ success: true })

    const result = await generateChapterSynopsis(
      { workspaceId: 'proj-1', chapter },
      { runDistillation, mutationService: service },
    )

    expect(result).toMatchObject({
      success: true,
      synopsis: '主角在废墟中立誓离乡。',
      revision: 5,
      unchanged: false,
    })
    expect(runDistillation).toHaveBeenCalledTimes(1)
    expect(runDistillation.mock.calls[0][1]).toMatchObject({ chunkSize: 1 })
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'proj-1',
        chapterId: 'ch-1',
        expectedRevision: 4,
        origin: 'ai-rewrite',
        mutation: { type: 'update-synopsis', synopsis: '主角在废墟中立誓离乡。' },
      }),
    )
  })

  it('trims the summary before it reaches the authoritative write', async () => {
    const { service, mutate } = mutationService({ success: true })
    const result = await generateChapterSynopsis(
      { workspaceId: 'proj-1', chapter },
      { runDistillation: async () => workflow('  既有梗概\n  '), mutationService: service },
    )

    expect(result).toMatchObject({ success: true, synopsis: '既有梗概' })
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: { type: 'update-synopsis', synopsis: '既有梗概' },
      }),
    )
  })

  it('skips the model call for an empty chapter', async () => {
    const runDistillation = vi.fn(async () => workflow('不应发生'))

    const result = await generateChapterSynopsis(
      { workspaceId: 'proj-1', chapter: { ...chapter, content: '' } },
      { runDistillation, mutationService: mutationService({ success: true }).service },
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('还没有正文')
    expect(runDistillation).not.toHaveBeenCalled()
  })

  it('does not write a synopsis when the task returns nothing usable', async () => {
    const mutate = vi.fn()

    const result = await generateChapterSynopsis(
      { workspaceId: 'proj-1', chapter },
      {
        runDistillation: async () => workflow('   '),
        mutationService: { mutate } as unknown as ChapterMutationService,
      },
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('没有返回')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('surfaces a concurrent edit as a conflict instead of a silent failure', async () => {
    const { service } = mutationService({ success: false, conflict: true })

    const result = await generateChapterSynopsis(
      { workspaceId: 'proj-1', chapter },
      { runDistillation: async () => workflow('梗概'), mutationService: service },
    )

    expect(result).toMatchObject({
      success: false,
      conflict: true,
      currentRevision: 7,
    })
  })

  it('passes the abort signal through to the distillation chunk run', async () => {
    const runDistillation = vi.fn(async () => workflow('梗概'))
    const controller = new AbortController()

    await generateChapterSynopsis(
      { workspaceId: 'proj-1', chapter, signal: controller.signal },
      {
        runDistillation,
        mutationService: mutationService({ success: true }).service,
      },
    )

    const input = runDistillation.mock.calls[0][0] as ProjectDistillationInput
    expect(input.taskId).toContain('chapter-synopsis')
    expect(runDistillation.mock.calls[0][1]).toMatchObject({ signal: controller.signal })
  })
})
