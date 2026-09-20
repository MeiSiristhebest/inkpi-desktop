export interface WritingGoalStore {
  get(projectId: string): Promise<number | null>
  set(projectId: string, goal: number): Promise<void>
  remove(projectId: string): Promise<void>
}
