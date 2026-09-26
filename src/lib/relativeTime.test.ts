import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './relativeTime'

const NOW = 1_800_000_000_000

describe('formatRelativeTime', () => {
  it('reads like the interval an author actually means', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('刚刚')
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
    expect(formatRelativeTime(NOW - 2 * 3_600_000, NOW)).toBe('2 小时前')
    expect(formatRelativeTime(NOW - 3 * 86_400_000, NOW)).toBe('3 天前')
  })

  it('falls back to an absolute date once "days ago" stops being useful', () => {
    expect(formatRelativeTime(NOW - 400 * 86_400_000, NOW)).toBe(
      new Date(NOW - 400 * 86_400_000).toLocaleDateString(),
    )
  })

  it('treats a future timestamp as just now instead of a negative interval', () => {
    expect(formatRelativeTime(NOW + 10 * 60_000, NOW)).toBe('刚刚')
    expect(formatRelativeTime(Number.NaN, NOW)).toBe('刚刚')
  })
})
