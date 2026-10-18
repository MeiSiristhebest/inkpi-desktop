import { describe, expect, it } from 'vitest'
import { ReaderSimulatorEngine } from './ReaderSimulatorEngine'

const simulate = (content: string) =>
  ReaderSimulatorEngine.simulateChapter({
    chapterId: 'c1',
    chapterTitle: '合成',
    chapterOrder: 1,
    content,
  })

describe('reader observations do not impersonate measured feedback', () => {
  it('does not score, praise, diagnose or invent votes for empty content', () => {
    const result = simulate(' \n ')
    expect(result.comments).toEqual([])
    expect(result.suggestions).toEqual([])
    expect(result.toxicAlerts).toEqual([])
    expect(result).not.toHaveProperty('toxicityScore')
    expect(result).not.toHaveProperty('logicScore')
    expect(result).not.toHaveProperty('pleasureScore')
  })

  it.each(['她没有跪下，而是抵抗命令。', '“我绝不会跪下。”她说。', '如果跪下会怎样？'])(
    '%s is evidence for review, not an asserted humiliating event',
    (text) => {
      const result = simulate(text)
      expect(result.toxicAlerts).toEqual([])
      expect(result.comments.length).toBeGreaterThan(0)
      expect(result.comments.every((c) => c.sentiment === 'review_question')).toBe(true)
      for (const comment of result.comments) {
        expect(comment.sourceStart).toBeGreaterThanOrEqual(0)
        expect(text.slice(comment.sourceStart, comment.sourceEnd)).toBe(comment.targetSnippet)
        expect(comment.commentText).not.toMatch(/主角下跪|怒退订|战力完全崩塌/)
        expect(comment).not.toHaveProperty('upvotes')
      }
    },
  )

  it('does not treat absence of its vocabulary as a flaw or invent applause', () => {
    expect(simulate('她将失散的孩子带回了家。').comments).toEqual([])
    const result = simulate('众人讨论“伏笔”这个写作术语。')
    expect(result.comments.every((c) => c.sentiment === 'review_question')).toBe(true)
    expect(result.comments.some((c) => c.commentText.includes('收回了伏笔'))).toBe(false)
  })
})
