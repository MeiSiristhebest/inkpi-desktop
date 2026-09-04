export interface SprintRecord {
  id: string
  projectId: string
  durationSeconds: number
  wordsWritten: number
  averageWpm: number
  peakWpm: number
  completedAt: number
}

export interface SprintRepository {
  getAll(): Promise<SprintRecord[]>
  save(record: SprintRecord): Promise<void>
  delete(id: string): Promise<void>
}
