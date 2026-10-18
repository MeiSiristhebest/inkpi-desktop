import { describe, expect, it } from 'vitest'
import { ScrapbookEngine } from './ScrapbookEngine'

describe('deleted text and literal recommendations', () => {
  it('preserves short deleted source including spaces and Unicode count', () => {
    const fragments = ScrapbookEngine.extractDeletedFragments(
      '前\n  秘密😀  \n后',
      '前\n后',
      'c',
      '标题',
    )
    expect(fragments).toHaveLength(1)
    expect(fragments[0].snippet).toBe('  秘密😀  \n')
    expect(fragments[0].wordCount).toBe(3)
  })
  it('does not split Unicode characters into invalid surrogate tokens', () => {
    expect(ScrapbookEngine.tokenize('😀😀甲乙')).not.toContain('\ude00\ud83d')
  })
  it('rejects invalid limits and honors a zero limit', () => {
    const fragment = {
      id: 'f',
      projectId: 'p',
      snippet: '失落城市',
      wordCount: 4,
      deletedAt: 1,
      tags: [],
      isReused: false,
    }
    expect(ScrapbookEngine.recommendFragments('失落城市', [fragment], 0)).toEqual([])
    expect(() => ScrapbookEngine.recommendFragments('失落城市', [fragment], -1)).toThrow()
  })
})
