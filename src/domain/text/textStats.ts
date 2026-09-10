// 纯文本统计与 HTML→纯文本转换（领域层，无 React / 无 DOM 依赖，便于单测）。

import { semanticDocumentFromHtml } from '../content'

/** 把 TipTap 产出的 HTML 投影到 Canonical Semantic Representation。 */
export const htmlToPlain = (html: string): string =>
  semanticDocumentFromHtml('legacy-html-input', html || '').text

/**
 * 实时字数统计模型（遵循网络文学与现代写作台通用事实标准）：
 * 剔除所有排版空白（空格、换行、制表符）后的所有有效可打印字符总量。
 */
export const countWords = (text: string): number => {
  if (!text) return 0
  return text.replace(/\s+/g, '').length
}
