import { describe, it, expect, vi } from 'vitest'
import { DefaultChapterMutationService } from './defaultChapterMutationService'
import type { ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { Clock } from '../ports/clock'
import { chapterSaveEvents } from '../ports/chapterSaveEvents'
import { draftJournal } from './draftJournal'

describe('DefaultChapterMutationService', () => {
  const fakeChapter: ChapterRecord = {
    id: 'ch-1',
    projectId: 'proj-1',
    volumeId: 'vol-1',
    title: '第一章 启程',
    content: '天地不仁，以万物为刍狗。',
    order: 1,
    wordCount: 11,
    status: 'draft',
    revision: 1,
    createdAt: 1000,
    updatedAt: 1000,
  }

  const createMockRepo = (initialChapters: ChapterRecord[] = [fakeChapter]): ProjectRepository => {
    const chapters = [...initialChapters]
    return {
      getAllProjects: vi.fn(),
      getProject: vi.fn(),
      saveProject: vi.fn(),
      deleteProject: vi.fn(),
      getAllVolumes: vi.fn(),
      getVolumesByProject: vi.fn(),
      saveVolume: vi.fn(),
      deleteVolume: vi.fn(),
      getAllChapters: vi.fn(async () => chapters),
      getChaptersByProject: vi.fn(async (pId) => chapters.filter((c) => c.projectId === pId)),
      saveChapter: vi.fn(async (ch) => {
        const idx = chapters.findIndex((c) => c.id === ch.id)
        if (idx >= 0) chapters[idx] = ch
        else chapters.push(ch)
      }),
      deleteChapter: vi.fn(),
    }
  }

  const mockClock: Clock = { now: () => 2000 }

  it('atomically mutates content, increments revision, updates wordCount and clears draft journal', async () => {
    const repo = createMockRepo()
    const service = new DefaultChapterMutationService(repo, mockClock)

    draftJournal.record({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      baseRevision: 1,
      editorContent: '草稿内容',
      updatedAt: 1500,
    })

    const listener = vi.fn()
    const unsub = chapterSaveEvents.subscribe(listener)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 1,
      mutation: { type: 'replace-content', content: '新世界降临。' },
      origin: 'user-typing',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.previousRevision).toBe(1)
      expect(result.newRevision).toBe(2)
      expect(result.chapter.content).toBe('新世界降临。')
      expect(result.chapter.revision).toBe(2)
      expect(result.chapter.wordCount).toBe(6)
      expect(result.chapter.updatedAt).toBe(2000)
    }

    expect(repo.saveChapter).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ chapter: expect.objectContaining({ id: 'ch-1', revision: 2 }) }),
    )
    expect(draftJournal.get('proj-1', 'ch-1')).toBeNull()

    unsub()
  })

  it('rejects mutation when CAS revision does not match', async () => {
    const repo = createMockRepo()
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 99,
      mutation: { type: 'replace-content', content: '分叉冲突内容' },
      origin: 'plugin',
    })

    expect(result.success).toBe(false)
    expect(result.conflict).toBe(true)
    if (!result.success) {
      expect(result.currentRevision).toBe(1)
      expect(result.error).toContain('CAS Conflict')
    }
    expect(repo.saveChapter).not.toHaveBeenCalled()
  })

  it('handles patch-range mutation correctly', async () => {
    const repo = createMockRepo()
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      mutation: { type: 'patch-range', from: 0, to: 2, content: '宇宙' },
      origin: 'ai-rewrite',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.chapter.content).toBe('宇宙不仁，以万物为刍狗。')
      expect(result.chapter.revision).toBe(2)
    }
  })

  it('returns failure if chapter does not exist', async () => {
    const repo = createMockRepo()
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'non-existent',
      mutation: { type: 'replace-content', content: 'text' },
      origin: 'user-typing',
    })

    expect(result.success).toBe(false)
    expect(result.conflict).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Chapter not found')
    }
  })
})
