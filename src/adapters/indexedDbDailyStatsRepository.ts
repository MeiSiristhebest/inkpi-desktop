import { db } from '../db/indexedDB'
import type { DailyStatItem } from '../domain/dashboard'
import { dailyStatsEvents } from '../ports/dailyStatsEvents'

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
    await db.runTransaction(['dailyStats'], (transaction, fail) => {
      const store = transaction.objectStore('dailyStats')
      const request = store.get(key)
      request.onerror = () =>
        fail(request.error ?? new Error('Could not read daily writing statistics'))
      request.onsuccess = () => {
        try {
          const existing = request.result as DailyStatItem | undefined
          store.put({
            key,
            projectId,
            date: dateStr,
            words: Math.max(0, (existing?.words || 0) + deltaWords),
          })
        } catch (error) {
          fail(error)
        }
      }
    })
    dailyStatsEvents.publish(projectId)
  }
}

export const indexedDbDailyStatsRepository = new IndexedDbDailyStatsRepository()
