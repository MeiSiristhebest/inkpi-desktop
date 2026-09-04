export type HunkResolution = "pending" | "applied" | "rejected"

export interface DiffHunkRecord {
  id: string
  oldStartLine: number
  oldLineCount: number
  newStartLine: number
  newLineCount: number
  lines: string[]
  resolution: HunkResolution
}

export interface DiffReviewRecord {
  id: string
  projectId: string
  chapterId: string
  title: string
  sourceText: string
  proposedText: string
  hunks: DiffHunkRecord[]
  status: "open" | "partially_applied" | "completed" | "discarded"
  summaryStats: {
    additions: number
    deletions: number
    unmodified: number
  }
  createdAt: number
  updatedAt: number
}

export interface DiffReviewRepository {
  getAll(projectId: string): Promise<DiffReviewRecord[]>
  get(id: string): Promise<DiffReviewRecord | undefined>
  getByChapter(chapterId: string): Promise<DiffReviewRecord[]>
  save(record: DiffReviewRecord): Promise<void>
  delete(id: string): Promise<void>
}
