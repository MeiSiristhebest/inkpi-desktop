import { describe, expect, it, vi } from 'vitest'
import type { ChapterRecord } from '../types'
import { chapterSaveEvents } from './chapterSaveEvents'

const chapter: ChapterRecord = {
  id: 'chapter-1',
  projectId: 'project-1',
  volumeId: 'volume-1',
  title: '第一章',
  order: 1,
  content: '<p>正文</p>',
  wordCount: 2,
  revision: 1,
  createdAt: 1,
  updatedAt: 2,
}

describe('chapter save events', () => {
  it('publishes an isolated snapshot and supports unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = chapterSaveEvents.subscribe(listener)

    chapterSaveEvents.publish(chapter)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0]).toEqual({ chapter })
    expect(listener.mock.calls[0][0].chapter).not.toBe(chapter)

    unsubscribe()
    chapterSaveEvents.publish(chapter)
    expect(listener).toHaveBeenCalledOnce()
  })
})
