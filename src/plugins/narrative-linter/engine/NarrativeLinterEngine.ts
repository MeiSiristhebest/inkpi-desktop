import type {
  LinterRuleConfig,
  LintIssue,
  LintSummary,
} from "../types"

export interface ILinterRule {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly defaultSeverity: "error" | "warning" | "info"
  check(text: string, options?: Record<string, unknown>): LintIssue[]
}

/**
 * 规则 1: 弱化副词堆叠检查 (Overused Adverbs)
 * 检查大量连续的"-地"修饰，倡导以动作和细节展现而非修饰词堆叠
 */
export class AdverbStackRule implements ILinterRule {
  readonly id = "LINT_ADVERB_STACK"
  readonly name = "弱化副词过度修饰"
  readonly description = "检测连续或过度密集的副词（如xx地），建议用生动的动词或细节替代"
  readonly defaultSeverity = "warning"

  check(text: string): LintIssue[] {
    const issues: LintIssue[] = []
    const lines = text.split(/\r?\n/)
    let currentOffset = 0

    lines.forEach((line, lineIdx) => {
      // 匹配连续双副词或密集副词，如 "狠狠地愤怒地" 或单句内出现 3 个以上的 "xx地"
      const matches = [...line.matchAll(/([\u4e00-\u9fa5]{2}地)/g)]
      if (matches.length >= 3) {
        matches.forEach((m) => {
          const start = currentOffset + (m.index ?? 0)
          issues.push({
            id: `adv-${lineIdx}-${m.index}`,
            ruleId: this.id,
            ruleName: this.name,
            severity: this.defaultSeverity,
            lineNumber: lineIdx + 1,
            startOffset: start,
            endOffset: start + m[0].length,
            matchedSnippet: m[0],
            message: `单句中副词修饰（${m[0]}）过于密集（本行累计 ${matches.length} 处），削弱了叙述张力。`,
            quickFix: {
              title: `精简并删除「${m[0]}」`,
              replacementText: "",
              range: [start, start + m[0].length],
            },
          })
        })
      }
      currentOffset += line.length + 1
    })

    return issues
  }
}

/**
 * 规则 2: 超长句窒息感/标点失衡检查 (Run-On Sentences)
 * 单个无逗号/句号切割的连续文本超过 65 字
 */
export class RunOnSentenceRule implements ILinterRule {
  readonly id = "LINT_RUN_ON_SENTENCE"
  readonly name = "超长从句/无间歇长句"
  readonly description = "单句无标点连续字数超过阈值，造成阅读窒息感"
  readonly defaultSeverity = "warning"

  check(text: string, options?: { maxClauseLength?: number }): LintIssue[] {
    const maxLen = options?.maxClauseLength ?? 55
    const issues: LintIssue[] = []
    const lines = text.split(/\r?\n/)
    let currentOffset = 0

    lines.forEach((line, lineIdx) => {
      const clauses = line.split(/[，。！？；、“”’（）]/)
      let clauseOffset = 0
      for (const clause of clauses) {
        const trimmed = clause.trim()
        if (trimmed.length > maxLen) {
          const start = currentOffset + line.indexOf(trimmed, clauseOffset)
          issues.push({
            id: `runon-${lineIdx}-${clauseOffset}`,
            ruleId: this.id,
            ruleName: this.name,
            severity: this.defaultSeverity,
            lineNumber: lineIdx + 1,
            startOffset: start,
            endOffset: start + trimmed.length,
            matchedSnippet: trimmed.slice(0, 30) + "...",
            message: `该分句连续长度达 ${trimmed.length} 字（阈值 ${maxLen} 字）未见停顿标点，严重破坏网文快节奏吸入感。`,
          })
        }
        clauseOffset += clause.length + 1
      }
      currentOffset += line.length + 1
    })

    return issues
  }
}

/**
 * 规则 3: 对话说教/百科式倒垃圾 (Dialogue Infodump)
 * 对话引号内包含过长的设定说明词汇或连续单次台词超过 120 字
 */
export class DialogueInfodumpRule implements ILinterRule {
  readonly id = "LINT_DIALOGUE_INFODUMP"
  readonly name = "对话违和倾倒世界观设定"
  readonly description = "角色台词长篇大论背书，将读者当做受众灌输百科设定"
  readonly defaultSeverity = "error"

  check(text: string): LintIssue[] {
    const issues: LintIssue[] = []
    const dialogueRegex = /“([^”]+)”/g
    let match: RegExpExecArray | null

    while ((match = dialogueRegex.exec(text)) !== null) {
      const dialogueContent = match[1]
      const start = match.index
      const isInfodump =
        dialogueContent.length > 100 ||
        (dialogueContent.length > 50 &&
          (dialogueContent.includes("正如你所知") ||
            dialogueContent.includes("顾名思义") ||
            dialogueContent.includes("根据帝国第") ||
            dialogueContent.includes("换言之，这个世界的法则")))

      if (isInfodump) {
        issues.push({
          id: `infodump-${start}`,
          ruleId: this.id,
          ruleName: this.name,
          severity: this.defaultSeverity,
          lineNumber: text.slice(0, start).split(/\r?\n/).length,
          startOffset: start,
          endOffset: start + match[0].length,
          matchedSnippet: match[0].slice(0, 40) + "...",
          message: `对话长达 ${dialogueContent.length} 字且带有生硬的说教/背景设定倒灌痕迹，角色声音失真。`,
          suggestedFix: "将说明性文字转移至环境烘托、动作交互或剧情冲突中自然流露",
        } as LintIssue)
      }
    }

    return issues
  }
}

/**
 * 规则 4: 禁忌词/现代网梗突兀出戏 (Anachronism & Banned Words)
 * 古风玄幻中突兀出现现代词汇（例如："降维打击"、"性价比"、"大数据"）
 */
export class AnachronismRule implements ILinterRule {
  readonly id = "LINT_ANACHRONISM"
  readonly name = "现代工业/网络热梗出戏词"
  readonly description = "在严肃古典/修真语境中误用现代专有名词导致读者出戏"
  readonly defaultSeverity = "error"

  private static readonly ANACHRONISTIC_WORDS = [
    "性价比",
    "大数据",
    "云计算",
    "打工人",
    "内卷",
    "降维打击",
    "KPI",
    "割韭菜",
  ]

  check(text: string): LintIssue[] {
    const issues: LintIssue[] = []
    const lines = text.split(/\r?\n/)
    let currentOffset = 0

    lines.forEach((line, lineIdx) => {
      for (const word of AnachronismRule.ANACHRONISTIC_WORDS) {
        let idx = line.indexOf(word)
        while (idx !== -1) {
          const start = currentOffset + idx
          issues.push({
            id: `anach-${lineIdx}-${idx}`,
            ruleId: this.id,
            ruleName: this.name,
            severity: this.defaultSeverity,
            lineNumber: lineIdx + 1,
            startOffset: start,
            endOffset: start + word.length,
            matchedSnippet: word,
            message: `检测到突兀的现代工业/网络梗词汇「${word}」，容易引发读者破防出戏。`,
          })
          idx = line.indexOf(word, idx + 1)
        }
      }
      currentOffset += line.length + 1
    })

    return issues
  }
}

/**
 * NarrativeLinterEngine: 统合规则管线与快速修补 (Pipeline + QuickFix)
 */
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
        ruleId: "LINT_ADVERB_STACK",
        name: "弱化副词过度修饰",
        enabled: true,
        severity: "warning",
        description: "检测连续或过度密集的副词，倡导动词白描",
      },
      {
        ruleId: "LINT_RUN_ON_SENTENCE",
        name: "超长从句/无间歇长句",
        enabled: true,
        severity: "warning",
        description: "单句无标点连续字数超过阈值造成阅读窒息",
      },
      {
        ruleId: "LINT_DIALOGUE_INFODUMP",
        name: "对话违和倾倒世界观设定",
        enabled: true,
        severity: "error",
        description: "角色台词长篇大论背书",
      },
      {
        ruleId: "LINT_ANACHRONISM",
        name: "现代工业/网络热梗出戏词",
        enabled: true,
        severity: "error",
        description: "在古典玄幻中误用现代专有名词",
      },
    ]
  }

  /**
   * 运行 Linter 检查
   */
  public lint(text: string, activeConfigs?: LinterRuleConfig[]): LintSummary {
    const activeMap = new Map<string, LinterRuleConfig>()
    if (activeConfigs) {
      activeConfigs.forEach((c) => activeMap.set(c.ruleId, c))
    }

    let allIssues: LintIssue[] = []

    for (const rule of this.rules) {
      const config = activeMap.get(rule.id)
      // 若有配置且被禁用，跳过
      if (config && !config.enabled) continue

      const issues = rule.check(text)
      if (config?.severity) {
        issues.forEach((i) => (i.severity = config.severity))
      }
      allIssues = allIssues.concat(issues)
    }

    // 统计
    let errorCount = 0
    let warningCount = 0
    let infoCount = 0

    allIssues.forEach((issue) => {
      if (issue.severity === "error") errorCount++
      else if (issue.severity === "warning") warningCount++
      else infoCount++
    })

    // 清洁度评分：100 扣除 (error*15 + warning*5 + info*1)
    const penalty = errorCount * 15 + warningCount * 5 + infoCount * 1
    const cleanScore = Math.max(0, Math.min(100, 100 - penalty))

    return {
      totalIssues: allIssues.length,
      errorCount,
      warningCount,
      infoCount,
      issues: allIssues,
      cleanScore,
    }
  }

  /**
   * 应用快速修复 (QuickFix)
   */
  public static applyQuickFix(text: string, issue: LintIssue): string {
    if (!issue.quickFix) return text
    const [start, end] = issue.quickFix.range
    return text.slice(0, start) + issue.quickFix.replacementText + text.slice(end)
  }
}
