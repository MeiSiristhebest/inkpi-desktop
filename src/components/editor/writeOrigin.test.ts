import { describe, it, expect } from 'vitest'
import {
  WRITE_ORIGIN_META,
  countsAsAuthorTyping,
  plainLength,
  readWriteOrigin,
} from './writeOrigin'

const tr = (tag?: unknown) => ({
  getMeta: (key: string) => (key === WRITE_ORIGIN_META ? tag : undefined),
})

describe('写入来源判定（§P3.10）', () => {
  it('treats an untagged transaction as the author typing', () => {
    expect(readWriteOrigin(undefined)).toBe('user-typing')
    expect(readWriteOrigin(tr())).toBe('user-typing')
    expect(countsAsAuthorTyping(tr('something-else'))).toBe(true)
  })

  it('takes AI adoption and bulk replace out of the author tally', () => {
    expect(readWriteOrigin(tr('ai'))).toBe('ai')
    expect(readWriteOrigin(tr('bulk-edit'))).toBe('bulk-edit')
    expect(countsAsAuthorTyping(tr('ai'))).toBe(false)
    expect(countsAsAuthorTyping(tr('bulk-edit'))).toBe(false)
  })
})

describe('正文长度度量（§P3.10）', () => {
  it('counts printable characters the same way the editor text does', () => {
    expect(plainLength('<p>寒潭 惊变</p><p>\n  剑气\n</p>')).toBe(6)
    expect(plainLength('')).toBe(0)
  })
})
