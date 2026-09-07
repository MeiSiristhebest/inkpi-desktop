import { db } from '../db/indexedDB'
import type { DailyStatItem } from '../domain/dashboard'

export interface DailyStatsRepository {
  getDailyStats(projectId: string): Promise<DailyStatItem[]>
  recordDailyWords(projectId: string, deltaWords: number): Promise<void>
}

export class IndexedDbDailyStatsRepository implements DailyStatsRepository {
  async getDailyStats(projectId: string): Promise<DailyStatItem[]> {
    const all = await db.getAll<DailyStatItem>('dailyStats')
    return all.filter((s) => s.projectId === projectId).sort((a, b) => a.date.localeCompare(b.date))
  }

  async recordDailyWords(projectId: string, deltaWords: number): Promise<void> {
    if (!projectId || deltaWords === 0) return
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const key = `${projectId}::${dateStr}`
    const existing = await db.get<DailyStatItem>('dailyStats', key)
    const nextWords = Math.max(0, (existing?.words || 0) + deltaWords)
    await db.put('dailyStats', {
      key,
      projectId,
      date: dateStr,
      words: nextWords,
    })
  }
}

export const indexedDbDailyStatsRepository = new IndexedDbDailyStatsRepository()
