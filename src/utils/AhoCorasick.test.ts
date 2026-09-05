import { describe, it, expect } from 'vitest'
import { GenericAhoCorasick } from './AhoCorasick'

describe('GenericAhoCorasick', () => {
  it('should correctly match multiple patterns with generic payloads', () => {
    const ac = new GenericAhoCorasick<{ type: string }>()
    ac.build([
      { keyword: 'he', payload: { type: 'pronoun' } },
      { keyword: 'she', payload: { type: 'pronoun' } },
      { keyword: 'his', payload: { type: 'possessive' } },
      { keyword: 'hers', payload: { type: 'possessive' } },
    ])

    const text = 'she knows hers and his he'
    const matches = ac.scan(text)

    expect(matches.length).toBe(6)

    const sheMatch = matches.find((m) => m.keyword === 'she')
    expect(sheMatch).toBeDefined()
    expect(sheMatch?.startIndex).toBe(0)
    expect(sheMatch?.endIndex).toBe(3)
    expect(sheMatch?.payload.type).toBe('pronoun')
  })

  it('handles empty input and empty patterns cleanly', () => {
    const ac = new GenericAhoCorasick<number>()
    ac.build([])
    expect(ac.scan('test')).toEqual([])

    ac.build([{ keyword: 'foo', payload: 1 }])
    expect(ac.scan('')).toEqual([])
  })
})
