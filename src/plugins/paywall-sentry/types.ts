export type PaywallRecommendation =
  | 'prime_paywall'
  | 'acceptable'
  | 'weak_cut'
  | 'toxic_drop'

export interface PaywallAuditResult {
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  wordCount: number
  ppiScore: number // 0 - 100
  cliffhangerScore: number // 0 - 100
  unresolvedDesireScore: number // 0 - 100
  powerClimaxScore: number // 0 - 100
  fatigueRiskScore: number // 0 - 100
  recommendation: PaywallRecommendation
  suggestions: string[]
}
