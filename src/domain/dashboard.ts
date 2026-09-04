import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'

export interface VolumeProgress {
  title: string
  current: number
  total: number
}

/**
 * 写作面板视图模型（纯数据聚合，无 React / 无 DOM / 无存储依赖）。
 * 把原本嵌在 DashboardView useEffect 里的派生计算抽离，使其可脱离 UI 单测，
 * 视图层只负责声明式渲染。
 */
export interface DashboardModel {
  project?: ProjectRecord
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  totalWords: number
  published: number
  drafted: number
  reviewed: number
  weekWords: number
  weekChapters: number
  todayWords: number
  todayChapters: number
  lastUpdated: number
  dailyWords: Record<string, number>
  volumeProgress: VolumeProgress[]
  streakDays: number
  idleDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** 时间戳 → YYYY-MM-DD（本地日期） */
export const toISODate = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeDashboardModel(
  projectId: string,
  project: ProjectRecord | undefined,
  volumes: VolumeRecord[],
  chapters: ChapterRecord[],
  now: number = 0,
): DashboardModel {
  const pv = volumes.filter((v) => v.projectId === projectId).sort((a, b) => a.order - b.order)
  const pc = chapters.filter((c) => c.projectId === projectId)
  const currentNow = now || (project?.updatedAt ?? 0)
  const weekAgo = currentNow - WEEK_MS
  const dayStart = currentNow - (currentNow % DAY_MS)

  const published = pc.filter((c) => c.status === 'published').length
  const drafted = pc.filter((c) => !c.status || c.status === 'draft').length
  const reviewed = pc.filter((c) => c.status === 'review').length

  const weekChs = pc.filter((c) => (c.updatedAt || 0) >= weekAgo)
  const todayChs = pc.filter((c) => (c.updatedAt || 0) >= dayStart)

  const dailyWords: Record<string, number> = {}
  pc.forEach((c) => {
    if (!c.updatedAt) return
    const d = toISODate(c.updatedAt)
    dailyWords[d] = (dailyWords[d] || 0) + (c.wordCount || 0)
  })

  const volumeProgress: VolumeProgress[] = pv.map((v) => {
    const volChs = pc.filter((c) => c.volumeId === v.id)
    const done = volChs.filter((c) => c.wordCount && c.wordCount > 0).length
    return { title: v.title, current: done, total: volChs.length }
  })

  const sortedDates = Object.keys(dailyWords).sort()
  let streakDays = 0
  let idleDays = 0
  if (sortedDates.length > 0) {
    const lastDay = new Date(sortedDates[sortedDates.length - 1]).getTime()
    idleDays = Math.floor((now - lastDay) / DAY_MS)
    let cursor = now
    while (dailyWords[toISODate(cursor)] > 0 || cursor >= lastDay) {
      if (dailyWords[toISODate(cursor)] > 0) streakDays++
      cursor -= DAY_MS
    }
  }

  return {
    project,
    volumes: pv,
    chapters: pc,
    totalWords: pc.reduce((a, c) => a + (c.wordCount || 0), 0),
    published,
    drafted,
    reviewed,
    weekWords: weekChs.reduce((a, c) => a + (c.wordCount || 0), 0),
    weekChapters: weekChs.length,
    todayWords: todayChs.reduce((a, c) => a + (c.wordCount || 0), 0),
    todayChapters: todayChs.length,
    lastUpdated: pc.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0),
    dailyWords,
    volumeProgress,
    streakDays,
    idleDays,
  }
}
