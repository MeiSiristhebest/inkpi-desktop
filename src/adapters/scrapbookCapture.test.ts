import { describe, expect, it, vi } from 'vitest'
import { db } from '../db/indexedDB'
import { indexedDbProjectRepository as projects } from './indexedDbProjectRepository'
import { indexedDbScrapbookRepository as scraps } from './indexedDbScrapbookRepository'
import type { ChapterRecord } from '../types'

const initial = (id: string): ChapterRecord => ({
  id,
  projectId: id,
  volumeId: 'v',
  title: '来源章',
  content: '<p>保留</p><p>短😀</p>',
  order: 0,
  wordCount: 4,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
})
describe('production chapter deletion capture', () => {
  it('captures a short deletion on actual CAS save, preserving source and retry idempotency', async () => {
    const before = initial('scrap-cas')
    await projects.saveChapter(before)
    const chapter = { ...before, content: '<p>保留</p>', revision: 2, updatedAt: 2 }
    expect(await projects.saveChapterCAS!({ chapter, expectedRevision: 1 })).toMatchObject({
      success: true,
    })
    const fragments = await scraps.getAll(before.projectId)
    expect(fragments).toHaveLength(1)
    expect(fragments[0]).toMatchObject({
      snippet: '\n短😀',
      sourceChapterId: before.id,
      sourceRevision: 1,
      sourceOffset: 2,
      wordCount: 2,
    })
    await projects.saveChapterCAS!({ chapter, expectedRevision: 1 })
    expect(await scraps.getAll(before.projectId)).toHaveLength(1)
  })
  it('rolls back chapter and journal if fragment persistence fails', async () => {
    const before = initial('scrap-rollback')
    await projects.saveChapter(before)
    const original = IDBObjectStore.prototype.put
    const fault = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'scrapbookFragments') throw new Error('fragment write failed')
      return original.apply(this, args)
    })
    try {
      await expect(
        projects.saveChapterCAS!({
          chapter: { ...before, content: '', revision: 2, updatedAt: 2 },
          expectedRevision: 1,
        }),
      ).rejects.toThrow('fragment write failed')
      expect(await db.get('chapters', before.id)).toEqual(before)
      expect(await scraps.getAll(before.projectId)).toEqual([])
      expect(await db.getByIndex('domainChangeSets', 'workspaceId', before.projectId)).toHaveLength(
        1,
      )
    } finally {
      fault.mockRestore()
    }
  })
  it('does not archive text on a rejected stale revision', async () => {
    const before = initial('scrap-stale')
    await projects.saveChapter(before)
    expect(
      await projects.saveChapterCAS!({
        chapter: { ...before, content: '', revision: 2 },
        expectedRevision: 0,
      }),
    ).toMatchObject({ success: false, conflict: true })
    expect(await scraps.getAll(before.projectId)).toEqual([])
  })
})
