// 中文段落排版与查找替换（领域层纯函数，无 React / 无 DOM 依赖）。

import { htmlToPlain } from './textStats'

export type TypographyPreset = 'classic-print' | 'web-novel' | 'dialogue' | 'clean'

/**
 * 多样化排版预设方案（满足传统出版、网络文学、剧本对话等不同文体创作）：
 *   - classic-print: 传统纸媒规范，段首缩进 2 个全角字符（　　），段落紧凑
 *   - web-novel: 现代网络小说快节奏，段首无缩进，依靠段落分行带来呼吸感
 *   - dialogue: 剧本/对话体，对话段顶格，叙述描述段缩进
 *   - clean: 清空一切段首空白，便于重新排版
 */
export const formatByPreset = (input: string, preset: TypographyPreset): string => {
  const text = htmlToPlain(input)
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return ''

  switch (preset) {
    case 'web-novel':
      return lines.map((l) => `<p>${l.replace(/^[　\s]+/, '')}</p>`).join('')
    case 'dialogue':
      return lines
        .map((l) => {
          const raw = l.replace(/^[　\s]+/, '')
          const isDialogue = /^[“"「『（(—]/.test(raw) || /^[^：:]{1,8}[：:]/.test(raw)
          return `<p>${isDialogue ? raw : `　　${raw}`}</p>`
        })
        .join('')
    case 'clean':
      return lines.map((l) => `<p>${l.replace(/^[　\s]+/, '')}</p>`).join('')
    case 'classic-print':
    default:
      return lines.map((l) => `<p>　　${l.replace(/^[　\s]+/, '')}</p>`).join('')
  }
}

/**
 * 中文段落一键缩进排版（向后兼容）：先抽取纯文本 → 去首尾空白 → 清除空行 →
 * 每段包成 <p> 并按 indent 设置加首行缩进。输入可为纯文本或 HTML，输出统一为 HTML，
 * 直接喂给 TipTap 的 setContent。
 */
export const formatChineseParagraphs = (
  input: string,
  indent: 'none' | 'full' | 'space2' = 'full',
): string => {
  if (indent === 'none') return formatByPreset(input, 'web-novel')
  const prefix = indent === 'full' ? '　　' : '  '
  const text = htmlToPlain(input)
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${prefix}${line}</p>`)
    .join('')
}

/**
 * 智能标点符号规整：
 *   - 英文常见标点转中文全角
 *   - 省略号 ... 规整为六点 ……
 *   - 破折号 -- 规整为双破折 ——
 *   - 智能中文化双引号配对（"text" → “text”）
 *   - 清洗连续多重无序标点（如 ？？？ → ？）
 */
export const fixPunctuation = (
  input: string,
  indent: 'none' | 'full' | 'space2' = 'full',
): string => {
  const prefix = indent === 'full' ? '　　' : indent === 'space2' ? '  ' : ''
  let text = htmlToPlain(input)
  text = text
    .replace(/,/g, '，')
    .replace(/:/g, '：')
    .replace(/;/g, '；')
    .replace(/\?/g, '？')
    .replace(/!/g, '！')
    .replace(/\.{3,}/g, '……')
    .replace(/。{3,}/g, '……')
    .replace(/--+/g, '——')
    .replace(/？{2,}/g, '？')
    .replace(/！{2,}/g, '！')

  // 成对英文双引号转中文“ ”
  let inQuote = false
  text = text.replace(/"/g, () => {
    const quote = inQuote ? '”' : '“'
    inQuote = !inQuote
    return quote
  })

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${prefix}${line}</p>`)
    .join('')
}

/**
 * 全局查找替换：对 HTML 字符串做字面量替换（按片段切分再拼接，避免正则注入）。
 * find 为空时原样返回。
 */
export const applyFindReplace = (html: string, find: string, replace: string): string => {
  if (!find) return html
  return (html || '').split(find).join(replace)
}
