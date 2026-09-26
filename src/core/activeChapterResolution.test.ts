import { describe, expect, it } from 'vitest'
import { resolveActiveChapter } from './activeChapterResolution'
import { projectContent } from '../domain/content'
import type { ChapterRecord } from '../types'

const first: ChapterRecord = {
  id: 'ch-1',
  projectId: 'ws-a',
  volumeId: 'vol-1',
  title: '第一章',
  content: '正文内容',
  order: 0,
  wordCount: 4,
  revision: 3,
  createdAt: 1,
  updatedAt: 1,
}
const second: ChapterRecord = { ...first, id: 'ch-2', title: '第二章', order: 1 }

const writingFor = (record: ChapterRecord) => ({
  id: record.id,
  revision: record.revision ?? 1,
  title: record.title,
  content: record.content,
  wordCount: record.wordCount,
  semanticDocument: projectContent(record.id, record.content, record.revision ?? 1),
})

describe('resolveActiveChapter', () => {
  it('resolves the editor chapter by id, not by list position', () => {
    expect(resolveActiveChapter([first, second], writingFor(second))?.id).toBe('ch-2')
  })

  it('fails closed instead of guessing a chapter the writer is not looking at', () => {
    const stored = [first, second]
    expect(resolveActiveChapter(stored, undefined)).toBeNull()
    // The editor can outrun a stale hierarchy reload. Falling back to stored[0] would have
    // pointed the plugin host at 第一章 while the author was reading an unsynced chapter.
    expect(stored[0].id).toBe('ch-1')
    expect(resolveActiveChapter(stored, writingFor({ ...first, id: 'ch-not-loaded' }))).toBeNull()
  })

  it('overlays the live editor buffer onto the stored record and keeps its identity fields', () => {
    const resolved = resolveActiveChapter([first, second], {
      ...writingFor(second),
      content: '尚未落盘的新正文',
      wordCount: 7,
      revision: 12,
    })

    expect(resolved).toMatchObject({
      id: 'ch-2',
      projectId: 'ws-a',
      volumeId: 'vol-1',
      title: '第二章',
      content: '尚未落盘的新正文',
      wordCount: 7,
      revision: 12,
    })
    expect(resolved?.order).toBe(1)
  })
})
