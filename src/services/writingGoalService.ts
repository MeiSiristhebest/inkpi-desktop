import { indexedDbWritingGoalStore } from '../adapters/indexedDbWritingGoalStore'
import type { WritingGoalStore } from '../ports/writingGoalStore'

export const DEFAULT_DAILY_GOAL = 4600

export class WritingGoalService {
  private readonly cache = new Map<string, number | null>()
  private readonly store: WritingGoalStore

  constructor(store: WritingGoalStore = indexedDbWritingGoalStore) {
    this.store = store
  }

  async getGoal(projectId: string): Promise<number | null> {
    const goal = await this.store.get(projectId)
    this.cache.set(projectId, goal)
    return goal
  }

  /** Returns the last loaded value without making synchronous storage authoritative. */
  getGoalSync(projectId: string): number | null {
    return this.cache.get(projectId) ?? null
  }

  async setGoal(projectId: string, goal: number): Promise<void> {
    await this.store.set(projectId, goal)
    this.cache.set(projectId, goal)
  }

  async removeGoal(projectId: string): Promise<void> {
    await this.store.remove(projectId)
    this.cache.set(projectId, null)
  }
}

export const writingGoalService = new WritingGoalService()
