import { indexedDbSettingsKVRepository } from './indexedDbSettingsKVRepository'
import { localStorageKeyValueStore } from './localStorageKeyValueStore'
import type { WritingGoalStore } from '../ports/writingGoalStore'

const DAILY_GOAL_KEY = 'goalDaily'

/**
 * Canonical daily-goal storage. IndexedDB owns the value; the old
 * project-scoped localStorage key is read once as a migration source and
 * removed after a successful migration or write.
 */
export const indexedDbWritingGoalStore: WritingGoalStore = {
  async get(projectId: string): Promise<number | null> {
    const stored = await indexedDbSettingsKVRepository.get<unknown>(projectId, DAILY_GOAL_KEY, null)
    const canonical = parseGoal(stored)
    if (canonical !== null) return canonical

    const legacy = parseGoal(localStorageKeyValueStore.getSync(`inkpi-daily-goal-${projectId}`))
    if (legacy === null) return null

    await indexedDbSettingsKVRepository.set(projectId, DAILY_GOAL_KEY, legacy)
    await localStorageKeyValueStore.remove?.(`inkpi-daily-goal-${projectId}`)
    return legacy
  },

  async set(projectId: string, goal: number): Promise<void> {
    await indexedDbSettingsKVRepository.set(projectId, DAILY_GOAL_KEY, goal)
    await localStorageKeyValueStore.remove?.(`inkpi-daily-goal-${projectId}`)
  },

  async remove(projectId: string): Promise<void> {
    await indexedDbSettingsKVRepository.remove(projectId, DAILY_GOAL_KEY)
    await localStorageKeyValueStore.remove?.(`inkpi-daily-goal-${projectId}`)
  },
}

function parseGoal(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
