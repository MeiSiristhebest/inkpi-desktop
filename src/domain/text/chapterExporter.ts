// 章节导出（领域层纯函数，无 React / 无 DOM 依赖）。
//
// 仅负责「纯文本 / Markdown」两种确定性转换；HTML 文档的 <style> 排版与 <title> 包装
// 属于呈现细节，已移至 src/adapters/htmlChapterRenderer.ts，领域层不再包含任何 CSS / 标签结构。

import { htmlToPlain } from './textStats'

/**
 * 导出当前章节为纯文本或 Markdown：
 *   - txt → 纯文本（去标签、保留段落换行）
 *   - md  → 保留 TipTap 原始 HTML（兼容 Markdown 阅读器）
 *
 * HTML 格式请使用 renderChapterHtmlDocument（见 src/adapters/htmlChapterRenderer.ts）。
 */
export const exportChapter = (
  content: string,
  format: 'txt' | 'md',
  _title = '未命名章节',
): string => {
  if (format === 'txt') return htmlToPlain(content)
  return content || ''
}

/** 字体族 → CSS font-family 变量 */
export const fontStackFor = (
  kind: 'serif' | 'sans' | 'mono' | 'wenkai' | 'kaiti' | 'fangsong' | string,
): string => {
  switch (kind) {
    case 'wenkai':
      return 'var(--ink-font-wenkai)'
    case 'kaiti':
      return 'var(--ink-font-kaiti)'
    case 'fangsong':
      return 'var(--ink-font-fangsong)'
    case 'sans':
      return 'var(--ink-font-sans)'
    case 'mono':
      return 'var(--ink-font-mono)'
    case 'serif':
    default:
      return 'var(--ink-font-serif)'
  }
}
