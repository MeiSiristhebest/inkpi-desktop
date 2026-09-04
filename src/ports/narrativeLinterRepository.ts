export type LinterSeverity = "error" | "warning" | "info"

export interface LinterRuleConfig {
  ruleId: string
  name: string
  enabled: boolean
  severity: LinterSeverity
  customThreshold?: number
  description: string
}

export interface LinterProjectConfigRecord {
  projectId: string
  rules: LinterRuleConfig[]
  ignoredIssueKeys: string[]
  updatedAt: number
}

export interface NarrativeLinterRepository {
  getConfig(projectId: string): Promise<LinterProjectConfigRecord | undefined>
  saveConfig(record: LinterProjectConfigRecord): Promise<void>
}
