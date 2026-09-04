// 书籍封面确定性渐变调色板（装饰性书封艺术，非 UI 主题色）。
//
// 按书名 hash 选取，保证同一本书封面颜色稳定。这是刻意的、每本书各异的封面美术，
// 不归入 --ink-* 主题令牌体系（主题令牌用于 UI 框架/状态色），故集中在此具名模块，
// 便于统一维护与替换（评审 §1.5）。

export const BOOK_COVER_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#1f2937', '#374151'],
  ['#3b2f2f', '#5b4636'],
  ['#1e3a34', '#2f5d52'],
  ['#2a2440', '#43356b'],
  ['#3a2b1f', '#6b4a2b'],
  ['#243b53', '#3a5a7a'],
  ['#3a1f2b', '#6b2f47'],
  ['#1f3a2e', '#2f6b4f'],
]

/** 按书名确定性选取一组封面渐变（[from, to]）。 */
export const pickCoverPalette = (title: string): readonly [string, string] => {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return BOOK_COVER_PALETTES[h % BOOK_COVER_PALETTES.length]
}
