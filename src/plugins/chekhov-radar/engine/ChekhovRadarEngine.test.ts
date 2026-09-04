import { describe, it, expect } from 'vitest'
import { ChekhovRadarEngine } from './ChekhovRadarEngine'
import type { ChekhovGunRecord } from '../../ports/chekhovGunRepository'

describe('ChekhovRadarEngine', () => {
  it('computes stats correctly including closure rate and rusting count', () => {
    const mockGuns: ChekhovGunRecord[] = [
      {
        id: 'g1',
        projectId: 'p1',
        gunName: '神秘黑鼎',
        category: 'item',
        status: 'fired',
        plantChapterOrder: 1,
        actualFiredChapterOrder: 25,
        plantSnippet: '捡到一个黑鼎',
        rustingDistance: 0,
        isRustingAlert: false,
        updatedAt: Date.now(),
      },
      {
        id: 'g2',
        projectId: 'p1',
        gunName: '三年之约',
        category: 'promise',
        status: 'dormant',
        plantChapterOrder: 2,
        plantSnippet: '立下誓言',
        rustingDistance: 48,
        isRustingAlert: true,
        updatedAt: Date.now(),
      },
      {
        id: 'g3',
        projectId: 'p1',
        gunName: '母亲的遗言',
        category: 'secret',
        status: 'incubating',
        plantChapterOrder: 10,
        plantSnippet: '临终嘱托',
        rustingDistance: 40,
        isRustingAlert: true,
        updatedAt: Date.now(),
      },
    ]

    const stats = ChekhovRadarEngine.computeStats(mockGuns, 50)
    expect(stats.totalGuns).toBe(3)
    expect(stats.firedCount).toBe(1)
    expect(stats.rustingCount).toBe(2)
    expect(stats.closureRate).toBe(33)
    expect(stats.healthGrade).toBe('DANGER')
  })

  it('detects potential guns from narrative text', () => {
    const text = '韩立在坊市偶然得到了一枚残破的青铜镜，上面隐隐刻着身世灭门之谜。'
    const suggestions = ChekhovRadarEngine.detectPotentialGuns(text)

    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((s) => s.category === 'item')).toBe(true)
    expect(suggestions.some((s) => s.category === 'secret')).toBe(true)
  })

  it('checks mentioned guns in text', () => {
    const guns: ChekhovGunRecord[] = [
      {
        id: 'g1',
        projectId: 'p1',
        gunName: '太虚神剑',
        category: 'item',
        status: 'dormant',
        plantChapterOrder: 5,
        plantSnippet: '获得太虚神剑',
        rustingDistance: 10,
        isRustingAlert: false,
        updatedAt: Date.now(),
      },
      {
        id: 'g2',
        projectId: 'p1',
        gunName: '幽冥令',
        category: 'item',
        status: 'fired',
        plantChapterOrder: 1,
        plantSnippet: '幽冥令现世',
        rustingDistance: 0,
        isRustingAlert: false,
        updatedAt: Date.now(),
      },
    ]

    const activeMentioned = ChekhovRadarEngine.checkMentionedGuns(
      guns,
      '主角突然拔出了随身携带的太虚神剑，剑气如虹！'
    )
    expect(activeMentioned.length).toBe(1)
    expect(activeMentioned[0].gunName).toBe('太虚神剑')
  })
})
