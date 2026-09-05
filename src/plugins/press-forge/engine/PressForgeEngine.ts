import type { PressFormatOptions, TypesetResult } from '../types'

import redWords from '../../safe-gate/data/seed-words-red.json'

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
      description: '段首全角双空格缩进，标准双引号，段间空行，严格清理非法不可见字符。',
      defaultOptions: {
        presetId: 'qidian-standard',
        indentSpaces: 2,
        paragraphSpacing: 1,
        dialogueStyle: 'standard-quotes',
        fixPunctuation: true,
        checkSensitiveWords: true,
      },
    },
    'jinjiang-clean': {
      name: '晋江文学城高洁版',
      description: '极度严格的涉政与敏感词扫描，紧凑排版，全角直角双引号支持。',
      defaultOptions: {
        presetId: 'jinjiang-clean',
        indentSpaces: 2,
        paragraphSpacing: 1,
        dialogueStyle: 'standard-quotes',
        fixPunctuation: true,
        checkSensitiveWords: true,
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
        fixPunctuation: true,
        checkSensitiveWords: true,
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
        fixPunctuation: true,
        checkSensitiveWords: false,
      },
    },
  }

  /**
   * 共享 safe-gate 红色高危词库与基础敏感词库
   */
  static readonly SENSITIVE_WORDS: string[] = Array.from(
    new Set([
      '中南海', '领导人', '暴动', '分裂', '毒品', '邪教', '违禁药品',
      ...(Array.isArray(redWords)
        ? redWords.map((item: any) => (typeof item === 'string' ? item : item.word)).filter(Boolean)
        : []),
    ])
  )

  /**
   * 核心 AST / 正则排版压制器
   */
  static formatText(rawContent: string, options: PressFormatOptions): TypesetResult {
    let text = rawContent || ''
    let fixedPunctuationCount = 0
    const warnings: string[] = []

    // 1. 规范化换行并清理行尾空格与不可见 BOM/零宽字符
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除非法零宽字符

    // 2. 标点正规化（若启用）
    if (options.fixPunctuation) {
      // 修复英文半角逗号句号
      const initial = text
      text = text
        .replace(/,/g, '，')
        .replace(/\?/g, '？')
        .replace(/!/g, '！')
        .replace(/:/g, '：')
        .replace(/;/g, '；')
        .replace(/\.{3,}/g, '……') // 修复多个点构成的伪省略号
        .replace(/-{2,}/g, '——') // 修复两个及以上短横构成的破折号
      if (text !== initial) {
        fixedPunctuationCount += 1
      }
    }

    // 3. 对话引号风格转换
    if (options.dialogueStyle === 'bracket') {
      text = text.replace(/“/g, '「').replace(/”/g, '」')
    }

    // 4. 段落拆分与缩进处理
    const rawParagraphs = text.split('\n').map((p) => p.trim()).filter((p) => p.length > 0)
    const indentStr = '　'.repeat(options.indentSpaces)

    const formattedParagraphs = rawParagraphs.map((p) => `${indentStr}${p}`)

    // 5. 段间空行合并
    const joinSeparator = '\n'.repeat(options.paragraphSpacing + 1)
    const formattedText = formattedParagraphs.join(joinSeparator)

    // 6. 敏感词预警检测
    if (options.checkSensitiveWords) {
      for (const sw of this.SENSITIVE_WORDS) {
        if (formattedText.includes(sw)) {
          warnings.push(`⚠️ 触发平台敏感词警报：「${sw}」，可能导致章节被直接屏蔽或限流。`)
        }
      }
    }

    const lineCount = formattedParagraphs.length
    const characterCount = formattedText.replace(/\s+/g, '').length

    return {
      formattedText,
      lineCount,
      characterCount,
      warnings,
      fixedPunctuationCount,
    }
  }
}
