import { describe, it, expect, vi } from 'vitest'
import { DefaultChapterMutationService } from './defaultChapterMutationService'
import type { ChapterRecord } from '../types'
import type { ProjectRepository } from '../ports/projectRepository'
import type { Clock } from '../ports/clock'
import { chapterSaveEvents } from '../ports/chapterSaveEvents'
import { draftJournal } from './draftJournal'
import { db } from '../db/indexedDB'

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
      editorContent: '新世界降临。',
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

  it('records positive word growth from an author save in dailyStats', async () => {
    const workspaceId = `author-daily-stats-${Date.now()}`
    const repo = createMockRepo([
      { ...fakeChapter, projectId: workspaceId, content: '', wordCount: 0 },
    ])
    const service = new DefaultChapterMutationService(repo, mockClock)

    try {
      const result = await service.mutate({
        workspaceId,
        chapterId: 'ch-1',
        expectedRevision: 1,
        mutation: { type: 'replace-content', content: '新世界降临。' },
        origin: 'user-typing',
        countAsAuthorWriting: true,
      })

      expect(result.success).toBe(true)
      const stats = (await db.getAll<{ projectId: string; words: number }>('dailyStats')).filter(
        (item) => item.projectId === workspaceId,
      )
      expect(stats).toHaveLength(1)
      expect(stats[0]?.words).toBe(6)
    } finally {
      for (const item of await db.getAll<{ key: string; projectId: string }>('dailyStats')) {
        if (item.projectId === workspaceId) await db.delete('dailyStats', item.key)
      }
    }
  })

  it('does not serialize an undefined optional status from a legacy chapter record', async () => {
    const legacyChapter: ChapterRecord = { ...fakeChapter }
    delete legacyChapter.status
    const repo = createMockRepo([legacyChapter])
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 1,
      mutation: { type: 'replace-content', content: '修订正文。' },
      origin: 'user-typing',
    })

    expect(result.success).toBe(true)
    const saved = vi.mocked(repo.saveChapter).mock.calls[0]?.[0]
    expect(saved).toBeDefined()
    expect(Object.hasOwn(saved!, 'status')).toBe(false)
  })

  it('preserves a newer draft written while an older snapshot is being saved', async () => {
    const chapters = [fakeChapter]
    const repo = createMockRepo(chapters)
    vi.mocked(repo.saveChapter).mockImplementation(async (chapter) => {
      draftJournal.record({
        workspaceId: 'proj-1',
        chapterId: 'ch-1',
        baseRevision: 1,
        editorContent: '<p>newer edit</p>',
        updatedAt: 2001,
      })
      const index = chapters.findIndex((item) => item.id === chapter.id)
      if (index >= 0) chapters[index] = chapter
    })
    const service = new DefaultChapterMutationService(repo, mockClock)

    draftJournal.record({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      baseRevision: 1,
      editorContent: '<p>saved snapshot</p>',
      updatedAt: 1500,
    })

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 1,
      mutation: { type: 'replace-content', content: '<p>saved snapshot</p>' },
      origin: 'user-typing',
    })

    expect(result.success).toBe(true)
    expect(draftJournal.get('proj-1', 'ch-1')?.editorContent).toBe('<p>newer edit</p>')
  })

  it('persists canonical title edits through the same revisioned mutation path', async () => {
    const repo = createMockRepo()
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 1,
      mutation: { type: 'update-title', title: '第二章 新标题' },
      origin: 'title-edit',
    })

    expect(result).toMatchObject({
      success: true,
      previousRevision: 1,
      newRevision: 2,
      chapter: { title: '第二章 新标题', content: fakeChapter.content, revision: 2 },
    })
    expect(repo.saveChapter).toHaveBeenCalledWith(
      expect.objectContaining({ title: '第二章 新标题', revision: 2 }),
    )

    const retry = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 2,
      mutation: { type: 'update-title', title: '第二章 新标题' },
      origin: 'title-edit',
    })
    expect(retry).toMatchObject({ success: true, previousRevision: 2, newRevision: 2 })
    expect(repo.saveChapter).toHaveBeenCalledTimes(1)
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

  it('applies chapter metadata to the latest record and preserves its body', async () => {
    const latest: ChapterRecord = {
      ...fakeChapter,
      content: '<p>另一窗口刚保存的新正文。</p>',
      synopsis: '最新梗概',
      revision: 2,
    }
    const repo = createMockRepo([latest])
    vi.mocked(repo.getVolumesByProject).mockResolvedValue([
      { id: 'vol-2', projectId: 'proj-1', title: '第二卷', order: 1, createdAt: 1, updatedAt: 1 },
    ])
    repo.saveChapterCAS = vi.fn(async ({ chapter, expectedRevision }) => {
      expect(expectedRevision).toBe(2)
      expect(chapter.content).toBe(latest.content)
      expect(chapter.synopsis).toBe(latest.synopsis)
      return { success: true, conflict: false, currentRevision: chapter.revision }
    })
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 2,
      mutation: { type: 'move-to-volume', volumeId: 'vol-2', order: 0 },
      origin: 'chapter-metadata',
    })

    expect(result).toMatchObject({
      success: true,
      chapter: {
        content: latest.content,
        synopsis: latest.synopsis,
        volumeId: 'vol-2',
        order: 0,
        revision: 3,
      },
    })
    expect(repo.saveChapter).not.toHaveBeenCalled()
  })

  it('rejects stale chapter metadata without writing the newer body', async () => {
    const latest: ChapterRecord = { ...fakeChapter, content: '<p>新正文</p>', revision: 2 }
    const repo = createMockRepo([latest])
    repo.saveChapterCAS = vi.fn().mockResolvedValue({
      success: false,
      conflict: true,
      currentRevision: 2,
      error: 'CAS Conflict',
    })
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 1,
      mutation: { type: 'update-status', status: 'review' },
      origin: 'chapter-metadata',
    })

    expect(result).toMatchObject({ success: false, conflict: true, currentRevision: 2 })
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

  it('writes the synopsis through the authoritative path and keeps it across content edits', async () => {
    const repo = createMockRepo()
    const service = new DefaultChapterMutationService(repo, mockClock)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      expectedRevision: 1,
      mutation: { type: 'update-synopsis', synopsis: '主角启程，留下未解的预言。' },
      origin: 'ai-rewrite',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.chapter.synopsis).toBe('主角启程，留下未解的预言。')
      expect(result.chapter.content).toBe(fakeChapter.content)
      expect(result.newRevision).toBe(2)

      // A later content edit must not silently drop the derived synopsis.
      const edited = await service.mutate({
        workspaceId: 'proj-1',
        chapterId: 'ch-1',
        expectedRevision: result.newRevision,
        mutation: { type: 'replace-content', content: '第二段正文。' },
        origin: 'user-typing',
      })
      expect(edited.success).toBe(true)
      if (edited.success) {
        expect(edited.chapter.synopsis).toBe('主角启程，留下未解的预言。')
        expect(edited.newRevision).toBe(3)
      }
    }
    const saved = (repo.saveChapter as ReturnType<typeof vi.fn>).mock.calls[0][0] as ChapterRecord
    expect(saved.synopsis).toBe('主角启程，留下未解的预言。')
  })

  it('treats a repeated synopsis as an exact no-op so a retried AI task cannot replay a domain change', async () => {
    const repo = createMockRepo([{ ...fakeChapter, synopsis: '已有梗概' }])
    const service = new DefaultChapterMutationService(repo, mockClock)
    const listener = vi.fn()
    const unsubscribe = chapterSaveEvents.subscribe(listener)

    const result = await service.mutate({
      workspaceId: 'proj-1',
      chapterId: 'ch-1',
      mutation: { type: 'update-synopsis', synopsis: '已有梗概' },
      origin: 'ai-rewrite',
    })
    unsubscribe()

    expect(result).toMatchObject({
      success: true,
      conflict: false,
      previousRevision: 1,
      newRevision: 1,
      wordCountDelta: 0,
    })
    expect(repo.saveChapter).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
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
