import { describe, it, expect } from 'vitest'
import { AuthorOpsEngine } from './AuthorOpsEngine'
import type { MetricLogEntry } from '../types'

describe('AuthorOpsEngine (连载运营台账与作者商业名片)', () => {
  it('只比较同口径连续章节，并应用作者给出的提醒阈值与说明', () => {
    const logs: MetricLogEntry[] = [
      {
        date: '2026-09-01',
        period: '发布后 24 小时',
        cohort: '同一批到达读者',
        metricDefinition: '订阅人数 / 到达人数',
        chasingReadCount: 5000,
        averageSubscription: 3000,
        retentionRate: 85,
        dropOffChapter: 10,
        dropOffReason: '正常自然流失',
        counterAction: '维持节奏',
      },
      {
        date: '2026-09-02',
        period: '发布后 24 小时',
        cohort: '同一批到达读者',
        metricDefinition: '订阅人数 / 到达人数',
        chasingReadCount: 3800,
        averageSubscription: 2500,
        retentionRate: 68, // 留存暴跌 17%
        dropOffChapter: 11,
        dropOffReason: '主角被反派踩脸未及时反击',
        counterAction: '加速下章反杀',
      },
    ]

    const analyses = AuthorOpsEngine.analyzeDropOff(logs, 12)
    expect(analyses.length).toBe(1)
    expect(analyses[0].isSevereCliff).toBe(true)
    expect(analyses[0].gradientLoss).toBe(17)
    expect(analyses[0].probableReason).toBe('主角被反派踩脸未及时反击')
    expect(analyses[0].recommendedCounterAction).toBe('加速下章反杀')
  })

  it('能规范生成包含版权作品总字数的商业品牌名片', () => {
    const card = AuthorOpsEngine.generateBusinessCard(
      '天蚕土豆',
      '白金作家',
      [{ title: '斗破苍穹', genre: '东方玄幻', totalWords: 5000000, status: 'finished' }],
      'https://afdian.com/author',
    )
    expect(card).toContain('天蚕土豆')
    expect(card).toContain('5000000 字')
    expect(card).toContain('《斗破苍穹》')
  })
})
