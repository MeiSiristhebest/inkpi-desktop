import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db/indexedDB'
import { IndexedDbDailyStatsRepository } from './indexedDbDailyStatsRepository'

describe('IndexedDbDailyStatsRepository', () => {
  const projectId = 'daily-stats-concurrent-write-test'
  const firstWindow = new IndexedDbDailyStatsRepository()
  const secondWindow = new IndexedDbDailyStatsRepository()

  afterEach(async () => {
    for (const item of await db.getAll<{ key: string; projectId: string }>('dailyStats')) {
      if (item.projectId === projectId) await db.delete('dailyStats', item.key)
    }
  })

  it('preserves simultaneous word-count increments from separate writer instances', async () => {
    const increments = Array.from({ length: 24 }, (_, index) =>
      (index % 2 === 0 ? firstWindow : secondWindow).recordDailyWords(projectId, 3),
    )

    await Promise.all(increments)

    const stats = await firstWindow.getDailyStats(projectId)
    expect(stats).toHaveLength(1)
    expect(stats[0]?.words).toBe(72)
  })
})
