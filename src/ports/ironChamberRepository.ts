export type ChamberLockMode = 'words' | 'minutes' | 'dual'
export type ChamberStatus = 'idle' | 'locked' | 'completed' | 'emergency_abort'

export interface IronChamberRecord {
  id: string
  projectId: string
  mode: ChamberLockMode
  targetWords: number
  targetMinutes: number
  startWords: number
  currentWords: number
  status: ChamberStatus
  pledgedAt: number
  completedAt?: number
  emergencyReasons?: string[]
  chapterId?: string
  measurementUnit?: 'unicode_non_whitespace'
  chapterRevisionAtStart?: number
}

export interface IronChamberRepository {
  getAll(projectId: string): Promise<IronChamberRecord[]>
  getActive(projectId: string): Promise<IronChamberRecord | undefined>
  get(id: string): Promise<IronChamberRecord | undefined>
  save(record: IronChamberRecord): Promise<void>
  startSession(record: IronChamberRecord): Promise<void>
  finishSession(record: IronChamberRecord): Promise<void>
  delete(id: string): Promise<void>
}
