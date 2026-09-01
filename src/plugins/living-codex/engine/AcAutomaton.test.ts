import { describe, it, expect } from 'vitest'
import { AcAutomaton } from './AcAutomaton'

describe('AcAutomaton Multi-Pattern String Scanner', () => {
  it('should initialize with empty patterns and return empty hits', () => {
    const scanner = new AcAutomaton()
    scanner.build([])
    expect(scanner.getPatternCount()).toBe(0)
    expect(scanner.scan('任何文本')).toEqual([])
  })

  it('should accurately match single entity by primary name and alias', () => {
    const scanner = new AcAutomaton()
    scanner.build([
      { id: 'char-1', name: '陈渊', aliases: ['渊哥', '废脉少主'] },
      { id: 'item-1', name: '青铜小塔', aliases: ['混沌塔'] },
    ])

    expect(scanner.getPatternCount()).toBe(5)

    const text = '渊哥站在山巅，手持青铜小塔，冷冷注视着前方。'
    const hits = scanner.scan(text)

    expect(hits).toHaveLength(2)
    expect(hits[0]).toEqual({
      entityId: 'char-1',
      keyword: '渊哥',
      startIndex: 0,
      endIndex: 2,
    })
    expect(hits[1]).toEqual({
      entityId: 'item-1',
      keyword: '青铜小塔',
      startIndex: 9,
      endIndex: 13,
    })
  })

  it('should handle overlapping and substring patterns correctly (Failure Pointer merging)', () => {
    const scanner = new AcAutomaton()
    scanner.build([
      { id: 'c1', name: '青岚宗' },
      { id: 'c2', name: '青岚' },
      { id: 'c3', name: '宗门' },
    ])

    const text = '这里是青岚宗门前。'
    const hits = scanner.scan(text)

    // 匹配 "青岚" (0-2), "青岚宗" (0-3), "宗门" (2-4)
    expect(hits.length).toBeGreaterThanOrEqual(3)
    const keywords = hits.map((h) => h.keyword)
    expect(keywords).toContain('青岚')
    expect(keywords).toContain('青岚宗')
    expect(keywords).toContain('宗门')
  })

  it('should safely handle empty text, whitespace and non-matched text', () => {
    const scanner = new AcAutomaton()
    scanner.build([{ id: '1', name: '萧景行' }])

    expect(scanner.scan('')).toEqual([])
    expect(scanner.scan('   ')).toEqual([])
    expect(scanner.scan('今天天气真好')).toEqual([])
  })
})
