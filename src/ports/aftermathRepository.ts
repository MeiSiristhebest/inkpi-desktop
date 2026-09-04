export type PatchChangeType = "attribute_update" | "new_relation" | "ownership_transfer" | "status_change"
export type PatchStatus = "pending" | "applied" | "rejected"

export interface AftermathPatchRecord {
  id: string
  projectId: string
  chapterId: string
  chapterOrder?: number
  entityId: string
  entityName: string
  changeType: PatchChangeType
  propertyName: string
  beforeValue: string
  afterValue: string
  evidenceSnippet: string
  status: PatchStatus
  createdAt: number
  appliedAt?: number
}

export interface AftermathRepository {
  getAll(projectId: string): Promise<AftermathPatchRecord[]>
  getByChapter(chapterId: string): Promise<AftermathPatchRecord[]>
  get(id: string): Promise<AftermathPatchRecord | undefined>
  save(record: AftermathPatchRecord): Promise<void>
  delete(id: string): Promise<void>
}
