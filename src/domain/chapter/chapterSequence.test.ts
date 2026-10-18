import { describe, expect, it } from 'vitest'
import { projectChapterSequence, latestPositionedChapterNumber } from './chapterSequence'
import type { ChapterRecord, VolumeRecord } from '../../types'
describe('project chapter numbers', () => {
  it('uses volume and within-volume order, not the zero-based storage order as a chapter number', () => {
    const chapters = [
      { id: 'later', projectId: 'p', volumeId: 'v2', order: 0 },
      { id: 'second', projectId: 'p', volumeId: 'v1', order: 1 },
      { id: 'first', projectId: 'p', volumeId: 'v1', order: 0 },
      { id: 'orphan', projectId: 'p', volumeId: 'missing', order: 100 },
      { id: 'foreign', projectId: 'q', volumeId: 'v1', order: 0 },
    ] as ChapterRecord[]
    const volumes = [
      { id: 'v2', projectId: 'p', order: 1 },
      { id: 'v1', projectId: 'p', order: 0 },
    ] as VolumeRecord[]
    const sequence = projectChapterSequence('p', chapters, volumes)
    expect(sequence.map((chapter) => [chapter.id, chapter.chapterNumber])).toEqual([
      ['first', 1],
      ['second', 2],
      ['later', 3],
      ['orphan', null],
    ])
    expect(latestPositionedChapterNumber(sequence)).toBe(3)
    expect(chapters[0].order).toBe(0)
  })
  it('leaves chapters without a registered volume unpositioned', () => {
    const sequence = projectChapterSequence(
      'p',
      [{ id: 'c', projectId: 'p', volumeId: 'v', order: 0 }] as ChapterRecord[],
      [],
    )
    expect(sequence[0].chapterNumber).toBeNull()
    expect(latestPositionedChapterNumber(sequence)).toBe(0)
  })
})
