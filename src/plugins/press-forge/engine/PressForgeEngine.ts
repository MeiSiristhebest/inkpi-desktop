import type { PressFormatOptions, TypesetResult } from '../types'

export class PressForgeEngine {
  /**
   * 预置多平台规范
   */
  static readonly PRESETS: Record<
    string,
    { name: string; description: string; defaultOptions: PressFormatOptions }
  > = {
    'qidian-standard': {
      name: '起点 / 创世标准',
      description: '段首全角双空格缩进，标准双引号，段间空行，保留 Unicode 字符。',
      defaultOptions: {
        presetId: 'qidian-standard',
        indentSpaces: 2,
        paragraphSpacing: 1,
        dialogueStyle: 'standard-quotes',
        fixPunctuation: false,
        checkSensitiveWords: false,
      },
    },
    'jinjiang-clean': {
      name: '晋江文学城高洁版',
      description: '缩进与空行的文本预设，实际投稿规则由作者核对。',
      defaultOptions: {
        presetId: 'jinjiang-clean',
        indentSpaces: 2,
        paragraphSpacing: 1,
        dialogueStyle: 'standard-quotes',
        fixPunctuation: false,
        checkSensitiveWords: false,
      },
    },
    'fanqie-compact': {
      name: '番茄 / 七猫移动流',
      description: '段落极短，适合手机端沉浸流阅读，加大行距，突出对话冲击力。',
      defaultOptions: {
        presetId: 'fanqie-compact',
        indentSpaces: 0,
        paragraphSpacing: 1,
        dialogueStyle: 'standard-quotes',
        fixPunctuation: false,
        checkSensitiveWords: false,
      },
    },
    'print-typeset': {
      name: '纸质实体书排版',
      description: '全角两格传统缩进，无段间多余空行，破折号与省略号标准六角对齐。',
      defaultOptions: {
        presetId: 'print-typeset',
        indentSpaces: 2,
        paragraphSpacing: 0,
        dialogueStyle: 'standard-quotes',
        fixPunctuation: false,
        checkSensitiveWords: false,
      },
    },
  }

  static readonly SENSITIVE_WORDS: string[] = []

  static formatText(rawContent: string, options: PressFormatOptions): TypesetResult {
    if (
      !Number.isInteger(options.indentSpaces) ||
      options.indentSpaces < 0 ||
      options.indentSpaces > 4 ||
      !Number.isInteger(options.paragraphSpacing) ||
      options.paragraphSpacing < 0 ||
      options.paragraphSpacing > 3
    )
      throw new Error('缩进必须为 0–4 的整数，段间空行必须为 0–3 的整数。')
    if (!['standard-quotes', 'bracket', 'dash'].includes(options.dialogueStyle))
      throw new Error('未知引号格式。')
    let text = rawContent.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '')
    let fixedPunctuationCount = 0
    if (options.fixPunctuation) {
      const protectedParts = text.split(
        /(https?:\/\/[^\s]+|[\u0060][^\u0060]*[\u0060]|[A-Za-z]:[\\/][^\s]+|\d[\d.,:\-]*\d)/gu,
      )
      const replacements: Record<string, string> = {
        ',': '，',
        '?': '？',
        '!': '！',
        ':': '：',
        ';': '；',
      }
      text = protectedParts
        .map((part, index) =>
          index % 2
            ? part
            : part.replace(/[,?!:;]|\.{3,}|-{2,}/g, (match) => {
                fixedPunctuationCount++
                return replacements[match] ?? (match[0] === '.' ? '……' : '——')
              }),
        )
        .join('')
    }
    if (options.dialogueStyle === 'bracket') text = text.replace(/“/g, '「').replace(/”/g, '」')
    let paragraphs = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (options.dialogueStyle === 'dash')
      paragraphs = paragraphs.map((line) => line.replace(/^[“"「](.*)[”"」]$/u, '——$1'))
    const formattedText = paragraphs
      .map((line) => '　'.repeat(options.indentSpaces) + line)
      .join('\n'.repeat(options.paragraphSpacing + 1))
    const words = options.checkSensitiveWords
      ? [...new Set(options.literalWords?.filter((word) => word.trim()) ?? [])]
      : []
    const warnings = words
      .filter((word) => rawContent.includes(word))
      .map((word) => '关键词命中「' + word + '」，请结合原文核对；不代表平台判定。')
    return {
      formattedText,
      lineCount: paragraphs.length,
      characterCount: Array.from(formattedText.replace(/\s/gu, '')).length,
      warnings,
      fixedPunctuationCount,
    }
  }
}
