export interface MetricLogEntry {
  date: string
  period?: string
  cohort?: string
  metricDefinition?: string
  chasingReadCount: number
  averageSubscription: number
  retentionRate: number
  dropOffChapter: number
  dropOffReason: string
  counterAction: string
}

export interface AuthorOpsProfileRecord {
  projectId: string
  authorName: string
  bio: string
  works: Array<{
    title: string
    genre: string
    totalWords: number
    status: 'serialized' | 'finished' | 'planning'
  }>
  supportChannels: {
    wechatPayQr?: string
    alipayQr?: string
    customUrl?: string
  }
  metricLogs: MetricLogEntry[]
  reminderThreshold?: number
  updatedAt: number
}

export interface AuthorOpsRepository {
  get(projectId: string): Promise<AuthorOpsProfileRecord | undefined>
  save(record: AuthorOpsProfileRecord): Promise<void>
}
