export interface PaywallAuditRecord {
  id: string
  projectId: string
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  wordCount: number
  ppiScore: number // 0 - 100 Paywall Potential Index
  cliffhangerScore: number // 0 - 100
  unresolvedDesireScore: number // 0 - 100
  powerClimaxScore: number // 0 - 100
  fatigueRiskScore: number // 0 - 100
  recommendation: 'prime_paywall' | 'acceptable' | 'weak_cut' | 'toxic_drop'
  suggestions: string[]
  updatedAt: number
}

export interface PaywallAuditRepository {
  getAll(projectId: string): Promise<PaywallAuditRecord[]>
  getByChapterId(chapterId: string): Promise<PaywallAuditRecord | undefined>
  save(record: PaywallAuditRecord): Promise<void>
  delete(id: string): Promise<void>
}
