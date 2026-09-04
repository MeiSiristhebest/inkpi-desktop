import type {
  MetricLogEntry,
  AuthorOpsProfileRecord,
} from "../../ports/authorOpsRepository"

export type { MetricLogEntry, AuthorOpsProfileRecord }

export interface RetentionDropAnalysis {
  dropOffChapter: number
  gradientLoss: number // 留存下降斜率
  isSevereCliff: boolean
  probableReason: string
  recommendedCounterAction: string
}
