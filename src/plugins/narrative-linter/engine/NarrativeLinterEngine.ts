import type { LinterRuleConfig, LintIssue, LintSummary } from '../types'

export interface ILinterRule {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly defaultSeverity: 'error' | 'warning' | 'info'
  check(text: string, options?: Record<string, unknown>): LintIssue[]
}

function linesWithOffsets(text: string) {
  const lines: { text: string; offset: number; number: number }[] = []
  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match[0].length === 0) break
    lines.push({ text: match[1], offset: match.index, number: lines.length + 1 })
  }
  return lines
}

function threshold(value: unknown, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('阈值须为正整数。')
  return value
}

export class AdverbStackRule implements ILinterRule {
  readonly id = 'LINT_ADVERB_STACK'
  readonly name = '同一行「地」字修饰词定位'
  readonly description = '定位同一行的字面词形；是否精简由作者决定'
  readonly defaultSeverity = 'warning'
  check(text: string, options?: Record<string, unknown>): LintIssue[] {
    const minimum = threshold(options?.minimumOccurrences, 3)
    const issues: LintIssue[] = []
    for (const line of linesWithOffsets(text)) {
      const matches = [...line.text.matchAll(/[\u4e00-\u9fff]{2}地/g)]
      if (matches.length < minimum) continue
      for (const match of matches) {
        const start = line.offset + match.index
        issues.push({
          id: `adv-${start}`,
          ruleId: this.id,
          ruleName: this.name,
          severity: this.defaultSeverity,
          lineNumber: line.number,
          startOffset: start,
          endOffset: start + match[0].length,
          matchedSnippet: match[0],
          message: `本行有 ${matches.length} 处符合此词形；不据此判断叙述质量。`,
          quickFix: {
            title: `在预览中删除「${match[0]}」`,
            replacementText: '',
            range: [start, start + match[0].length],
          },
        })
      }
    }
    return issues
  }
}

export class RunOnSentenceRule implements ILinterRule {
  readonly id = 'LINT_RUN_ON_SENTENCE'
  readonly name = '无停顿标点分句长度'
  readonly description = '列出超过作者阈值的连续分句'
  readonly defaultSeverity = 'warning'
  check(text: string, options?: Record<string, unknown>): LintIssue[] {
    const maxLength = threshold(options?.maxClauseLength, 55)
    const issues: LintIssue[] = []
    for (const line of linesWithOffsets(text)) {
      for (const match of line.text.matchAll(/[^，。！？；、“”‘’（）,.!?;:]+/g)) {
        const clause = match[0].trim()
        const length = Array.from(clause).length
        if (length <= maxLength) continue
        const start = line.offset + match.index + match[0].indexOf(clause)
        issues.push({
          id: `runon-${start}`,
          ruleId: this.id,
          ruleName: this.name,
          severity: this.defaultSeverity,
          lineNumber: line.number,
          startOffset: start,
          endOffset: start + clause.length,
          matchedSnippet: clause,
          message: `此分句含 ${length} 个 Unicode 字符，超过设置的 ${maxLength}；长度不证明节奏问题。`,
        })
      }
    }
    return issues
  }
}

export class DialogueInfodumpRule implements ILinterRule {
  readonly id = 'LINT_DIALOGUE_INFODUMP'
  readonly name = '长对白定位'
  readonly description = '统计成对引号内的长度，供作者审阅对白用途'
  readonly defaultSeverity = 'info'
  check(text: string, options?: Record<string, unknown>): LintIssue[] {
    const maxLength = threshold(options?.maxDialogueLength, 100)
    return [...text.matchAll(/“([^”]+)”/g)].flatMap((match): LintIssue[] => {
      const length = Array.from(match[1]).length
      if (length <= maxLength) return []
      const start = match.index
      return [
        {
          id: `dialogue-${start}`,
          ruleId: this.id,
          ruleName: this.name,
          severity: this.defaultSeverity,
          lineNumber: text.slice(0, start).split(/\r\n|\r|\n/).length,
          startOffset: start,
          endOffset: start + match[0].length,
          matchedSnippet: match[0],
          message: `引号内含 ${length} 个 Unicode 字符，超过设置的 ${maxLength}。用途和人物声音尚未判断。`,
        },
      ]
    })
  }
}

export class AnachronismRule implements ILinterRule {
  readonly id = 'LINT_ANACHRONISM'
  readonly name = '作者指定词表'
  readonly description = '仅定位作者启用的词项；时代和语境需另外判断'
  readonly defaultSeverity = 'info'
  check(text: string, options?: Record<string, unknown>): LintIssue[] {
    const words = options?.words
    if (!Array.isArray(words) || words.some((word) => typeof word !== 'string' || !word.trim()))
      throw new Error('词表须包含非空词项。')
    const issues: LintIssue[] = []
    for (const word of new Set(words as string[])) {
      let start = text.indexOf(word)
      while (start !== -1) {
        issues.push({
          id: `word-${word}-${start}`,
          ruleId: this.id,
          ruleName: this.name,
          severity: this.defaultSeverity,
          lineNumber: text.slice(0, start).split(/\r\n|\r|\n/).length,
          startOffset: start,
          endOffset: start + word.length,
          matchedSnippet: word,
          message: `命中作者启用的词项「${word}」。时代错误或读者反应尚未判断。`,
        })
        start = text.indexOf(word, start + word.length)
      }
    }
    return issues
  }
}

export class NarrativeLinterEngine {
  private rules: ILinterRule[] = [
    new AdverbStackRule(),
    new RunOnSentenceRule(),
    new DialogueInfodumpRule(),
    new AnachronismRule(),
  ]
  public static getDefaultRules(): LinterRuleConfig[] {
    return [
      {
        ruleId: 'LINT_ADVERB_STACK',
        name: '同一行修饰词定位',
        enabled: true,
        severity: 'warning',
        description: '词形计数；不证明冗余',
        options: { minimumOccurrences: 3 },
      },
      {
        ruleId: 'LINT_RUN_ON_SENTENCE',
        name: '分句长度定位',
        enabled: true,
        severity: 'warning',
        description: '超过作者阈值的连续分句',
        options: { maxClauseLength: 55 },
      },
      {
        ruleId: 'LINT_DIALOGUE_INFODUMP',
        name: '长对白定位',
        enabled: true,
        severity: 'info',
        description: '对白用途需结合语境判断',
        options: { maxDialogueLength: 100 },
      },
      {
        ruleId: 'LINT_ANACHRONISM',
        name: '作者指定词表',
        enabled: false,
        severity: 'info',
        description: '可选示例词表；须作者启用',
        options: {
          words: ['性价比', '大数据', '云计算', '打工人', '内卷', '降维打击', 'KPI', '割韭菜'],
        },
      },
    ]
  }
  public lint(text: string, configs = NarrativeLinterEngine.getDefaultRules()): LintSummary {
    const issues: LintIssue[] = []
    const configErrors: string[] = []
    for (const config of configs) {
      if (!config.enabled) continue
      const rule = this.rules.find((item) => item.id === config.ruleId)
      if (!rule) {
        configErrors.push(`未知规则：${config.ruleId}`)
        continue
      }
      const options = { ...config.options }
      if (config.customThreshold !== undefined) {
        const key =
          rule.id === 'LINT_RUN_ON_SENTENCE'
            ? 'maxClauseLength'
            : rule.id === 'LINT_DIALOGUE_INFODUMP'
              ? 'maxDialogueLength'
              : 'minimumOccurrences'
        options[key] = config.customThreshold
      }
      try {
        issues.push(
          ...rule
            .check(text, options)
            .map((issue) => ({ ...issue, severity: config.severity, sourceText: text })),
        )
      } catch (error) {
        configErrors.push(`${config.name}：${error instanceof Error ? error.message : '配置无效'}`)
      }
    }
    return {
      totalIssues: issues.length,
      errorCount: issues.filter((issue) => issue.severity === 'error').length,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
      infoCount: issues.filter((issue) => issue.severity === 'info').length,
      issues,
      configErrors,
    }
  }
  public static applyQuickFix(text: string, issue: LintIssue): string {
    if (!issue.quickFix || issue.sourceText !== text) return text
    const [start, end] = issue.quickFix.range
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > text.length ||
      start !== issue.startOffset ||
      end !== issue.endOffset ||
      text.slice(start, end) !== issue.matchedSnippet
    )
      return text
    return text.slice(0, start) + issue.quickFix.replacementText + text.slice(end)
  }
}
