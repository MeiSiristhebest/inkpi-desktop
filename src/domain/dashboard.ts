import { htmlToPlain } from './text'
import type { ProjectRecord, VolumeRecord, ChapterRecord, TableRowRecord } from '../types'

export interface VolumeProgress {
  id?: string
  title: string
  current: number
  total: number
}

export interface CharacterHeatmapItem {
  name: string
  counts: Record<string, number>
  total: number
}

export interface BurnDownPoint {
  label: string
  actualCum: number
  targetCum: number
}

export interface WritingGoalPlan {
  daily: number
  total: number
  deadline: string
}

export interface DailyStatItem {
  key?: string
  projectId?: string
  date: string
  words: number
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

  // 扩展与对齐原版核心字段
  unresolvedForeshadowsCount: number
  unusedIdeasCount: number
  progressWeekSum: number // 来自《写作进度》近7天登记实际字数之和
  progressDailyList: { date: string; words: number }[] // 近7日进度表登记
  dailyStatsMap: Record<string, number> // 真实每日自动码字量历史 (26周打卡)
  characterHeatmap: CharacterHeatmapItem[] // 角色在各章出场分布
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
  foreshadowRows: TableRowRecord[] = [],
  ideasRows: TableRowRecord[] = [],
  progressRows: TableRowRecord[] = [],
  dailyStatsRecords: DailyStatItem[] = [],
  characterNames: string[] = [],
): DashboardModel {
  const pv = volumes.filter((v) => v.projectId === projectId).sort((a, b) => a.order - b.order)
  const pc = chapters.filter((c) => c.projectId === projectId)
  const currentNow = now > 0 ? now : (project?.updatedAt ?? (chapters[0]?.updatedAt || 0))
  const weekAgo = currentNow - WEEK_MS

  // 严格基于本地日期的今日零点时间戳
  const todayDateObj = new Date(currentNow)
  todayDateObj.setHours(0, 0, 0, 0)
  const dayStart = todayDateObj.getTime()
  const todayDateStr = toISODate(todayDateObj.getTime())

  const published = pc.filter((c) => {
    const s = c.status as string | undefined
    return s === 'published' || s === '完稿' || s === '已发布'
  }).length
  const drafted = pc.filter((c) => {
    const s = c.status as string | undefined
    return !s || s === 'draft' || s === '草稿' || s === '修改'
  }).length
  const reviewed = pc.filter((c) => c.status === 'review').length

  const weekChs = pc.filter((c) => (c.updatedAt || 0) >= weekAgo)
  const todayChs = pc.filter((c) => (c.updatedAt || 0) >= dayStart)

  // 1. 每日统计聚合：结合 chapters 自身字数与 dailyStatsRecords
  const dailyWords: Record<string, number> = {}
  dailyStatsRecords.forEach((item) => {
    if (item.date && typeof item.words === 'number') {
      dailyWords[item.date] = Math.max(dailyWords[item.date] || 0, item.words)
    }
  })
  pc.forEach((c) => {
    if (!c.updatedAt) return
    const d = toISODate(c.updatedAt)
    dailyWords[d] = (dailyWords[d] || 0) + (c.wordCount || 0)
  })

  // 2. 分卷进度
  const volumeProgress: VolumeProgress[] = pv.map((v) => {
    const volChs = pc.filter((c) => c.volumeId === v.id)
    const done = volChs.filter((c) => {
      const s = c.status as string | undefined
      return (c.wordCount && c.wordCount > 0) || s === 'published' || s === '完稿' || s === '已发布'
    }).length
    return { title: v.title, current: done, total: volChs.length }
  })

  // 3. 连续码字与断更天数
  let streakDays = 0
  let idleDays = 0
  const sortedDates = Object.keys(dailyWords)
    .filter((k) => dailyWords[k] > 0)
    .sort()
  if (sortedDates.length > 0) {
    const lastDateStr = sortedDates[sortedDates.length - 1]
    const [ly, lm, ld] = lastDateStr.split('-').map(Number)
    const lastDayMidnight = new Date(ly, lm - 1, ld).getTime()

    idleDays = Math.max(0, Math.floor((dayStart - lastDayMidnight) / DAY_MS))

    let cursorDate = new Date(todayDateObj.getTime())
    if ((dailyWords[toISODate(cursorDate.getTime())] || 0) === 0) {
      cursorDate.setDate(cursorDate.getDate() - 1)
    }

    while ((dailyWords[toISODate(cursorDate.getTime())] || 0) > 0) {
      streakDays++
      cursorDate.setDate(cursorDate.getDate() - 1)
    }
  }

  // 4. 伏笔追踪与灵感素材过滤
  const unresolvedForeshadows = foreshadowRows.filter((r) => {
    const statePair = Object.entries(r.data || {}).find(([k]) => k.includes('状态'))
    return statePair ? statePair[1] === '未回收' : true
  })

  const unusedIdeas = ideasRows.filter((r) => {
    const statePair = Object.entries(r.data || {}).find(([k]) => k.includes('状态'))
    return statePair ? statePair[1] === '未用' : true
  })

  // 5. 写作进度（近 7 天手工或自动登记）
  const progressDailyList: { date: string; words: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDateObj.getTime() - i * DAY_MS)
    const dateStr = toISODate(d.getTime())
    const row = progressRows.find((r) => r.data?.['日期'] === dateStr)
    const words =
      row && parseInt(row.data?.['实际字数'] || '0', 10)
        ? parseInt(row.data?.['实际字数'] || '0', 10)
        : dailyWords[dateStr] || 0
    progressDailyList.push({ date: dateStr, words })
  }
  const progressWeekSum = progressDailyList.reduce((sum, item) => sum + item.words, 0)

  // 6. 角色出场统计（扫描正文）
  const validChapters = pc
    .filter((c) => Boolean(c.content && c.content.trim()))
    .map((c) => ({
      id: c.id,
      plainText: htmlToPlain(c.content || ''),
    }))

  const characterHeatmap: CharacterHeatmapItem[] = characterNames
    .map((name) => {
      const trimmed = name.trim()
      const counts: Record<string, number> = {}
      let total = 0
      for (const ch of validChapters) {
        if (!ch.plainText) continue
        let chCount = 0
        let pos = 0
        while ((pos = ch.plainText.indexOf(trimmed, pos)) !== -1) {
          chCount++
          pos += trimmed.length
        }
        if (chCount > 0) {
          counts[ch.id] = chCount
          total += chCount
        }
      }
      return { name: trimmed, counts, total }
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)

  const totalWords = pc.reduce((a, c) => a + (c.wordCount || 0), 0)
  const todayWords =
    dailyWords[todayDateStr] || todayChs.reduce((a, c) => a + (c.wordCount || 0), 0)

  return {
    project,
    volumes: pv,
    chapters: pc,
    totalWords,
    published,
    drafted,
    reviewed,
    weekWords: weekChs.reduce((a, c) => a + (c.wordCount || 0), 0),
    weekChapters: weekChs.length,
    todayWords,
    todayChapters: todayChs.length,
    lastUpdated: pc.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0),
    dailyWords,
    volumeProgress,
    streakDays,
    idleDays,
    unresolvedForeshadowsCount: unresolvedForeshadows.length,
    unusedIdeasCount: unusedIdeas.length,
    progressWeekSum,
    progressDailyList,
    dailyStatsMap: dailyWords,
    characterHeatmap,
  }
}
