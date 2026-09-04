export interface EntityOccurrence {
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  snippet: string
  offset: number
}

export interface MemoryPalaceSnapshotRecord {
  id: string
  projectId: string
  entityId: string
  entityName: string
  category: string
  aliases: string[]
  firstAppearedChapterId?: string
  lastAppearedChapterId?: string
  totalOccurrences: number
  timelineSpanText?: string
  occurrences: EntityOccurrence[]
  updatedAt: number
}

export interface MemoryPalaceRepository {
  getAll(projectId: string): Promise<MemoryPalaceSnapshotRecord[]>
  getByEntityId(entityId: string): Promise<MemoryPalaceSnapshotRecord | undefined>
  save(record: MemoryPalaceSnapshotRecord): Promise<void>
  delete(id: string): Promise<void>
}
