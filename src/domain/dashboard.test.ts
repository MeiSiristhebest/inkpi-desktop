import { describe, it, expect } from 'vitest'
import { computeDashboardModel } from './dashboard'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'

describe('computeDashboardModel 写作面板聚合算法', () => {
  const mockProject: ProjectRecord = {
    id: 'proj-1',
    name: '测试大作',
    genre: '科幻',
    createdAt: 1000,
    updatedAt: 1000,
  }

  const mockVolumes: VolumeRecord[] = [
    { id: 'v1', projectId: 'proj-1', title: '第一卷', order: 0, createdAt: 1000, updatedAt: 1000 },
    { id: 'v2', projectId: 'proj-1', title: '第二卷', order: 1, createdAt: 1000, updatedAt: 1000 },
  ]

  it('准确计算全书总字数、状态统计与分卷进度', () => {
    const chapters: ChapterRecord[] = [
      {
        id: 'c1',
        projectId: 'proj-1',
        volumeId: 'v1',
        title: '第1章',
        content: '',
        wordCount: 3000,
        order: 0,
        status: 'published',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'c2',
        projectId: 'proj-1',
        volumeId: 'v1',
        title: '第2章',
        content: '',
        wordCount: 2500,
        order: 1,
        status: 'draft',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'c3',
        projectId: 'proj-1',
        volumeId: 'v2',
        title: '第3章',
        content: '',
        wordCount: 0,
        order: 0,
        status: 'draft',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]

    const model = computeDashboardModel('proj-1', mockProject, mockVolumes, chapters, 2000)

    expect(model.totalWords).toBe(5500)
    expect(model.published).toBe(1)
    expect(model.drafted).toBe(2)
    expect(model.volumeProgress).toEqual([
      { title: '第一卷', current: 2, total: 2 },
      { title: '第二卷', current: 0, total: 1 },
    ])
  })

  it('正确根据本地时间跨度统计 streak 连续创作天数与 idle 停更天数', () => {
    const now = new Date(2025, 4, 10, 15, 30, 0).getTime() // 2025-05-10 15:30
    const todayTs = new Date(2025, 4, 10, 10, 0, 0).getTime() // 2025-05-10
    const yesterdayTs = new Date(2025, 4, 9, 20, 0, 0).getTime() // 2025-05-09
    const twoDaysAgoTs = new Date(2025, 4, 8, 14, 0, 0).getTime() // 2025-05-08

    const chapters: ChapterRecord[] = [
      {
        id: 'c1',
        projectId: 'proj-1',
        volumeId: 'v1',
        title: '第1章',
        content: '',
        wordCount: 2000,
        order: 0,
        createdAt: 1000,
        updatedAt: twoDaysAgoTs,
      },
      {
        id: 'c2',
        projectId: 'proj-1',
        volumeId: 'v1',
        title: '第2章',
        content: '',
        wordCount: 3000,
        order: 1,
        createdAt: 1000,
        updatedAt: yesterdayTs,
      },
      {
        id: 'c3',
        projectId: 'proj-1',
        volumeId: 'v1',
        title: '第3章',
        content: '',
        wordCount: 1500,
        order: 2,
        createdAt: 1000,
        updatedAt: todayTs,
      },
    ]

    const model = computeDashboardModel('proj-1', mockProject, mockVolumes, chapters, now)

    expect(model.todayWords).toBe(1500)
    expect(model.streakDays).toBe(3)
    expect(model.idleDays).toBe(0)
  })

  it('断更场景下正确给出停更天数且不会无限循环', () => {
    const now = new Date(2025, 4, 15, 12, 0, 0).getTime() // 2025-05-15
    const fiveDaysAgoTs = new Date(2025, 4, 10, 10, 0, 0).getTime() // 2025-05-10

    const chapters: ChapterRecord[] = [
      {
        id: 'c1',
        projectId: 'proj-1',
        volumeId: 'v1',
        title: '第1章',
        content: '',
        wordCount: 2000,
        order: 0,
        createdAt: 1000,
        updatedAt: fiveDaysAgoTs,
      },
    ]

    const model = computeDashboardModel('proj-1', mockProject, mockVolumes, chapters, now)

    expect(model.todayWords).toBe(0)
    expect(model.streakDays).toBe(0)
    expect(model.idleDays).toBe(5)
  })
})
