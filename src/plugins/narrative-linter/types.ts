import type { LinterSeverity, LinterRuleConfig, LinterProjectConfigRecord } from "../../ports/narrativeLinterRepository"

export type { LinterSeverity, LinterRuleConfig, LinterProjectConfigRecord }

export interface QuickFixAction {
  title: string
  replacementText: string
  range: [number, number] // [start, end] char offsets
}

export interface LintIssue {
  id: string
  ruleId: string
  ruleName: string
  severity: LinterSeverity
  lineNumber: number
  startOffset: number
  endOffset: number
  matchedSnippet: string
  message: string
  quickFix?: QuickFixAction
}

export interface LintSummary {
  totalIssues: number
  errorCount: number
  warningCount: number
  infoCount: number
  issues: LintIssue[]
  cleanScore: number // 100 - penalties
}
