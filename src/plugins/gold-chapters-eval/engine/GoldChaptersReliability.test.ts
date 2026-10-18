import { describe, expect, it } from 'vitest'
import { GoldChaptersEngine } from './GoldChaptersEngine'

describe('opening review evidence boundaries', () => {
  it.each([
    '',
    '本文没有复仇，也没有系统，更没有欺凌。原来只是词表。',
    '她要把失散的孩子带回家。航班停了，她赶往最后一班渡船。',
  ])('does not turn keyword presence or absence into a quality verdict: %s', (text) => {
    const result = GoldChaptersEngine.evaluate(text)
    expect(result).not.toHaveProperty('score')
    expect(result).not.toHaveProperty('isQualified')
    expect(result).not.toHaveProperty('suggestions')
  })

  it('reports missing input without generating a critique', () => {
    expect(GoldChaptersEngine.evaluate(' \n ')).toMatchObject({
      status: 'empty',
      observations: [],
      ranges: [],
    })
  })

  it('does not treat an opening outside the built-in vocabulary as deficient', () => {
    expect(GoldChaptersEngine.evaluate('她要把失散的孩子带回家。')).toMatchObject({
      status: 'no-matches',
      observations: [],
    })
  })

  it('binds every observation to exact source offsets and discloses partial coverage', () => {
    const text = '复仇系统欺凌。' + '正文'.repeat(2000) + '原来还有秘密。'
    const result = GoldChaptersEngine.evaluate(text)
    expect(result).toMatchObject({
      status: 'observed',
      sourceLength: text.length,
      scannedCharacters: 3500,
      complete: false,
    })
    expect(result.observations).toHaveLength(4)
    for (const observation of result.observations) {
      expect(text.slice(observation.start, observation.end)).toBe(observation.quote)
    }
  })
})
