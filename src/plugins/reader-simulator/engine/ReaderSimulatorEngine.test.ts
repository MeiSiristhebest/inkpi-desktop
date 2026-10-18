import { describe, it, expect } from 'vitest'
import { ReaderSimulatorEngine } from './ReaderSimulatorEngine'

describe('ReaderSimulatorEngine', () => {
  it('locates source-backed review questions without declaring humiliation or reader toxicity', () => {
    const text = '反派冷笑逼迫主角跪下磕头，自扇耳光，主角竟不忍加害放他离去。'
    const res = ReaderSimulatorEngine.simulateChapter({
      chapterId: 'c1',
      chapterTitle: '屈辱',
      chapterOrder: 1,
      content: text,
    })

    expect(res.toxicAlerts).toEqual([])
    expect(res.comments).toHaveLength(2)
    expect(res.comments.every((c) => c.sentiment === 'review_question')).toBe(true)
    expect(res.comments[0].commentText).toContain('实际动作、否定、转述还是假设')
    for (const comment of res.comments) {
      expect(text.slice(comment.sourceStart, comment.sourceEnd)).toBe(comment.targetSnippet)
      expect(comment).not.toHaveProperty('upvotes')
    }
    expect(res).not.toHaveProperty('toxicityScore')
  })

  it('locates a result to review without inventing reader pleasure or applause', () => {
    const text = '陆沉一剑破万法，杀伐果断，直接让高高在上的神王陨落，全场死寂！'
    const res = ReaderSimulatorEngine.simulateChapter({
      chapterId: 'c2',
      chapterTitle: '封神',
      chapterOrder: 2,
      content: text,
    })

    expect(res.comments).toHaveLength(1)
    expect(res.comments[0]).toMatchObject({
      sentiment: 'review_question',
      targetSnippet: text,
      sourceStart: 0,
      sourceEnd: text.length,
    })
    expect(res.comments[0].commentText).toContain('一剑破万法')
    expect(res).not.toHaveProperty('pleasureScore')
  })

  it('treats a negated action as a question about context, not as a reader verdict', () => {
    const text = '她没有跪下，而是抵抗命令。'
    const result = ReaderSimulatorEngine.simulateChapter({
      chapterId: 'c3',
      chapterTitle: '拒绝',
      chapterOrder: 3,
      content: text,
    })

    expect(result.comments).toHaveLength(1)
    expect(result.comments[0]).toMatchObject({
      targetSnippet: text,
      sourceStart: 0,
      sourceEnd: text.length,
      sentiment: 'review_question',
    })
    expect(result.comments[0].commentText).toContain('否定')
    expect(result.toxicAlerts).toEqual([])
  })

  it('returns no simulated reaction when the source is empty', () => {
    const result = ReaderSimulatorEngine.simulateChapter({
      chapterId: 'c-empty',
      chapterTitle: '空章',
      chapterOrder: 1,
      content: '',
    })

    expect(result.comments).toEqual([])
    expect(result.toxicAlerts).toEqual([])
    expect(result.suggestions).toEqual([])
  })

  it('includes the exact saved chapter revision in review input and local snapshots', () => {
    const params = {
      chapterId: 'c-revision',
      chapterTitle: '修订来源',
      chapterOrder: 4,
      sourceRevision: 12,
      content: '她没有跪下。',
    }
    const input = ReaderSimulatorEngine.buildAnalysisInput(params)
    const result = ReaderSimulatorEngine.simulateChapter(params)

    expect(input.chapter).toMatchObject({ id: 'c-revision', revision: 12 })
    expect(result.sourceRevision).toBe(12)
  })
})
