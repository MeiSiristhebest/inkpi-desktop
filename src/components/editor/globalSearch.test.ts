import { describe, expect, it } from 'vitest'
import { collectGlobalSearchHits } from './globalSearch'
import type { ChapterRecord } from '../../types'
import type { TimelineNode } from '../../plugins/timeline-grid/types'

const PROJECT = 'proj-global-search-test'

function chapter(overrides: Partial<ChapterRecord> & { id: string; order: number }): ChapterRecord {
  return {
    projectId: PROJECT,
    volumeId: 'vol-1',
    title: `第${overrides.order}章`,
    content: '',
    wordCount: 0,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

function node(
  overrides: Partial<TimelineNode> & { id: string; chapterOrder: number },
): TimelineNode {
  return {
    projectId: PROJECT,
    threadId: 'thread-1',
    eventTitle: '宗门大比',
    summary: '主角越阶胜出',
    status: 'planned',
    prerequisites: [],
    causalOutcome: '声名鹊起',
    relatedEntityIds: [],
    emotionalPolarity: 0.5,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

describe('collectGlobalSearchHits (§P3.8)', () => {
  it('lists a title hit and a content hit as separate rows on the same chapter', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [
        chapter({
          id: 'c1',
          order: 1,
          title: '金丹初成',
          content: '<p>他终于结成金丹，席间又有人提起金丹。</p>',
        }),
      ],
      [],
      '金丹',
    )
    expect(hits.map((h) => h.kind)).toEqual(['chapter-content', 'chapter-title'])
    expect(hits.map((h) => h.chapterId)).toEqual(['c1', 'c1'])
    expect(hits.find((h) => h.kind === 'chapter-content')?.snippet).toContain('他终于结成金丹')
  })

  it('matches case-insensitively while keeping the author casing in the snippet', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [
        chapter({
          id: 'c1',
          order: 1,
          title: 'The Gate',
          content: '<p>Lin Fan pushed the Iron Gate open.</p>',
        }),
      ],
      [],
      'iron gate',
    )
    const content = hits.find((h) => h.kind === 'chapter-content')
    expect(content?.count).toBe(1)
    expect(content?.snippet).toContain('Iron Gate')
  })

  it('reads chapter bodies as plain text, so tags never match', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [chapter({ id: 'c1', order: 1, title: '开场', content: '<p class="span">一段正文</p>' })],
      [],
      'span',
    )
    expect(hits).toEqual([])
  })

  it('drops a timeline hit that has no chapter to land on', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [chapter({ id: 'c1', order: 1, title: '开场' })],
      [node({ id: 'n1', chapterOrder: 9, eventTitle: '尚未落稿的伏笔' })],
      '伏笔',
    )
    expect(hits).toEqual([])
  })

  it('routes a timeline hit to the chapter that owns that order', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [
        chapter({ id: 'c1', order: 1, title: '开场' }),
        chapter({ id: 'c7', order: 7, title: '山门之战' }),
      ],
      [node({ id: 'n1', chapterOrder: 7, eventTitle: '山门血战', summary: '守阵成功' })],
      '山门',
    )
    expect(hits).toHaveLength(2)
    const timeline = hits.find((h) => h.kind === 'timeline-event')
    expect(timeline?.chapterId).toBe('c7')
    expect(timeline?.title).toBe('山门血战')
  })

  it('never surfaces another workspace timeline nodes (INV-03)', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [chapter({ id: 'c1', order: 1, title: '开场' })],
      [
        node({
          id: 'n1',
          chapterOrder: 1,
          projectId: 'proj-other-book',
          eventTitle: '别部书的大事',
        }),
      ],
      '大事',
    )
    expect(hits).toEqual([])
  })

  it('treats a blank query as no search at all', () => {
    const chapters = [chapter({ id: 'c1', order: 1, title: '金丹初成', content: '<p>金丹</p>' })]
    expect(collectGlobalSearchHits(PROJECT, chapters, [], '')).toEqual([])
    expect(collectGlobalSearchHits(PROJECT, chapters, [], '   ')).toEqual([])
  })

  it('orders the whole result set by match count, not by source', () => {
    const hits = collectGlobalSearchHits(
      PROJECT,
      [
        chapter({ id: 'c1', order: 1, title: '剑客', content: '<p>剑、剑、还是剑。</p>' }),
        chapter({ id: 'c2', order: 2, title: '试剑', content: '<p>一剑、又一剑。</p>' }),
      ],
      [],
      '剑',
    )
    expect(hits.map((h) => `${h.chapterId}:${h.kind}:${h.count}`)).toEqual([
      'c1:chapter-content:3',
      'c2:chapter-content:2',
      'c1:chapter-title:1',
      'c2:chapter-title:1',
    ])
  })
})
