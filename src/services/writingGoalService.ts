import { localStorageKeyValueStore } from '../adapters/localStorageKeyValueStore'
import type { KeyValueStore } from '../ports/keyValueStore'

export class WritingGoalService {
  constructor(private readonly kvStore: KeyValueStore = localStorageKeyValueStore) {}

  private getStorageKey(projectId: string): string {
    return `inkpi-daily-goal-${projectId}`
  }

  async getGoal(projectId: string): Promise<number | null> {
    try {
      const raw = await this.kvStore.get(this.getStorageKey(projectId))
      if (!raw) return null
      const parsed = Number.parseInt(raw, 10)
      return Number.isNaN(parsed) ? null : parsed
    } catch {
      return null
    }
  }

  getGoalSync(projectId: string): number | null {
    try {
      if (typeof this.kvStore.getSync === 'function') {
        const raw = this.kvStore.getSync(this.getStorageKey(projectId))
        if (!raw) return null
        const parsed = Number.parseInt(raw, 10)
        return Number.isNaN(parsed) ? null : parsed
      }
      return null
    } catch {
      return null
    }
  }

  async setGoal(projectId: string, goal: number): Promise<void> {
    await this.kvStore.set(this.getStorageKey(projectId), String(goal))
  }

  async removeGoal(projectId: string): Promise<void> {
    if (typeof this.kvStore.delete === 'function') {
      await this.kvStore.delete(this.getStorageKey(projectId))
    } else {
      await this.kvStore.set(this.getStorageKey(projectId), '')
    }
  }
}

export const writingGoalService = new WritingGoalService()
