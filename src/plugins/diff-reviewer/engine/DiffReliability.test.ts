import { describe, expect, it } from 'vitest'
import { DiffReviewerEngine } from './DiffReviewerEngine'

describe('exact revision diff', () => {
  it.each([
    ['', '插入😀\r\n'],
    ['全部删除\n', ''],
    ['甲\r\n乙\n丙', '甲\r\n改\n丙'],
    ['没有尾换行', '没有尾换行\n'],
    ['有尾换行\n', '有尾换行'],
  ])('reconstructs every accepted edit exactly', (before, after) => {
    const { hunks } = DiffReviewerEngine.computeDiff(before, after)
    expect(
      DiffReviewerEngine.applyHunks(
        before,
        hunks.map((h) => ({ ...h, resolution: 'applied' })),
      ),
    ).toBe(after)
  })
  it('refuses stale offsets instead of searching another repeated paragraph', () => {
    const before = '相同\n甲\n相同\n乙'
    const { hunks } = DiffReviewerEngine.computeDiff(before, '相同\n改\n相同\n乙')
    expect(() =>
      DiffReviewerEngine.applyHunks(
        '增加\n' + before,
        hunks.map((h) => ({ ...h, resolution: 'applied' })),
      ),
    ).toThrow()
  })
  it('counts unchanged lines outside displayed hunk context', () => {
    const before = Array.from({ length: 30 }, (_, i) => String(i)).join('\n')
    const { stats } = DiffReviewerEngine.computeDiff(before, before.replace('\n15\n', '\n改\n'))
    expect(stats.unmodified).toBe(29)
  })
})
