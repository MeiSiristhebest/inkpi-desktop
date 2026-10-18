import { describe, expect, it } from 'vitest'
import { ChekhovRadarEngine } from './ChekhovRadarEngine'
import type { ChekhovGunRecord } from '../types'

const gun = (overrides = {}): ChekhovGunRecord => ({
  id: 'g',
  projectId: 'p',
  gunName: '钥匙',
  category: 'item',
  status: 'dormant',
  plantChapterOrder: 1,
  plantSnippet: '钥匙',
  rustingDistance: 0,
  isRustingAlert: false,
  updatedAt: 0,
  ...overrides,
})

describe('author foreshadow records and literal mentions', () => {
  it('does not rate an empty record set or assume a reminder interval', () => {
    expect(ChekhovRadarEngine.computeStats([], 10).closureRate).toBeNull()
    expect(ChekhovRadarEngine.computeStats([gun()], 100).rustingCount).toBe(0)
    expect(
      ChekhovRadarEngine.computeStats(
        [gun({ plantChapterOrder: 0, expectedPayoffChapterOrder: 5 })],
        100,
      ).rustingCount,
    ).toBe(0)
  })
  it('excludes abandoned records from the closure denominator and honors author deadlines', () => {
    const stats = ChekhovRadarEngine.computeStats(
      [gun({ id: 'f', status: 'fired' }), gun({ id: 'a', status: 'abandoned' })],
      20,
    )
    expect(stats.closureRate).toBe(100)
    expect(
      ChekhovRadarEngine.computeStats([gun({ expectedPayoffChapterOrder: 20 })], 20).rustingCount,
    ).toBe(0)
    expect(
      ChekhovRadarEngine.computeStats([gun({ expectedPayoffChapterOrder: 20 })], 21).rustingCount,
    ).toBe(1)
  })
  it('quotes actual source spans and keeps literal mentions separate from saved records', () => {
    const text = '他没有见过那块玉佩，身世也无从得知。'
    for (const candidate of ChekhovRadarEngine.detectPotentialGuns(text))
      expect(text.slice(candidate.startOffset, candidate.endOffset)).toBe(candidate.snippet)
    expect(ChekhovRadarEngine.checkMentionedGuns([gun({ gunName: '' })], text, 'p')).toEqual([])
    expect(ChekhovRadarEngine.checkMentionedGuns([gun()], '钥匙', 'p')).toEqual([gun()])
  })
})
