import type { MetricLogEntry, RetentionDropAnalysis } from '../types'

export class AuthorOpsEngine {
  static validateLog(log: MetricLogEntry): void {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(log.date) ||
      Number.isNaN(Date.parse(log.date)) ||
      new Date(log.date).toISOString().slice(0, 10) !== log.date
    )
      throw new Error('日期必须为有效的 YYYY-MM-DD。')
    if (
      ![log.chasingReadCount, log.averageSubscription, log.retentionRate, log.dropOffChapter].every(
        Number.isFinite,
      ) ||
      !Number.isInteger(log.chasingReadCount) ||
      log.chasingReadCount < 0 ||
      log.averageSubscription < 0 ||
      log.retentionRate < 0 ||
      log.retentionRate > 100 ||
      !Number.isInteger(log.dropOffChapter) ||
      log.dropOffChapter < 1
    )
      throw new Error('人数、均订、留存率或章序无效。')
    if (!log.period?.trim() || !log.cohort?.trim() || !log.metricDefinition?.trim())
      throw new Error('请填写统计周期、读者群体与留存口径。')
  }
  static analyzeDropOff(logs: MetricLogEntry[], threshold?: number): RetentionDropAnalysis[] {
    if (
      threshold !== undefined &&
      (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)
    )
      throw new Error('提醒阈值必须在 0–100 个百分点之间。')
    const comparable = logs.filter(
      (l) =>
        l.period?.trim() &&
        l.cohort?.trim() &&
        l.metricDefinition?.trim() &&
        Number.isFinite(l.retentionRate) &&
        l.retentionRate >= 0 &&
        l.retentionRate <= 100 &&
        Number.isInteger(l.dropOffChapter) &&
        l.dropOffChapter >= 1,
    )
    const groups = new Map<string, MetricLogEntry[]>()
    for (const log of comparable) {
      const key = JSON.stringify([log.period, log.cohort, log.metricDefinition])
      const group = groups.get(key) ?? []
      group.push(log)
      groups.set(key, group)
    }
    const analyses: RetentionDropAnalysis[] = []
    for (const group of groups.values()) {
      group.sort((a, b) => a.dropOffChapter - b.dropOffChapter || a.date.localeCompare(b.date))
      for (let i = 1; i < group.length; i++) {
        const previous = group[i - 1]
        const current = group[i]
        if (current.dropOffChapter !== previous.dropOffChapter + 1) continue
        const loss = previous.retentionRate - current.retentionRate
        analyses.push({
          dropOffChapter: current.dropOffChapter,
          previousChapter: previous.dropOffChapter,
          gradientLoss: Math.round(loss * 100) / 100,
          isSevereCliff: threshold !== undefined && loss >= threshold,
          probableReason: current.dropOffReason.trim() || '未记录原因；留存差分不能确定归因。',
          recommendedCounterAction:
            current.counterAction.trim() || '核对样本口径、发布记录和作者保存的反馈。',
          period: current.period,
          cohort: current.cohort,
          metricDefinition: current.metricDefinition,
        })
      }
    }
    return analyses.sort((a, b) => b.gradientLoss - a.gradientLoss)
  }
  static generateBusinessCard(
    authorName: string,
    bio: string,
    works: Array<{ title: string; genre: string; totalWords: number; status: string }>,
    supportUrl?: string,
  ): string {
    if (works.some((w) => !Number.isFinite(w.totalWords) || w.totalWords < 0))
      throw new Error('作品字数必须为非负有限数。')
    const escape = (text: string) =>
      text.replace(/([\\\u0060*_[\]()<>#~])/g, '\\$1').replace(/\r?\n/g, ' ')
    const statuses: Record<string, string> = {
      serialized: '连载中',
      finished: '已完结',
      planning: '筹备中',
    }
    const list = works
      .map(
        (w) =>
          '- **《' +
          escape(w.title) +
          '》** · ' +
          escape(w.genre || '未填写类型') +
          ' · ' +
          w.totalWords +
          ' 字 [' +
          (statuses[w.status] ?? '状态未知') +
          ']',
      )
      .join('\n')
    let contact = '未填写公开联系或支持渠道。'
    if (supportUrl?.trim()) {
      const url = new URL(supportUrl)
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('联系链接只支持 HTTP 或 HTTPS。')
      contact = '[作者提供的联系 / 支持渠道](' + url.href.replace(/\)/g, '%29') + ')'
    }
    return (
      '# 作者名片 · ' +
      escape(authorName || '未填写笔名') +
      '\n\n' +
      (bio ? '> ' + escape(bio) : '简介未填写。') +
      '\n\n## 登记作品\n' +
      (list || '暂无登记作品。') +
      '\n\n累计登记 ' +
      works.reduce((sum, w) => sum + w.totalWords, 0) +
      ' 字。\n\n## 联系与支持\n' +
      contact
    )
  }
}
