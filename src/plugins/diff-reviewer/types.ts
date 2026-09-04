import type {
  HunkResolution,
  DiffHunkRecord,
  DiffReviewRecord,
} from "../../ports/diffReviewRepository"

export type { HunkResolution, DiffHunkRecord, DiffReviewRecord }

export interface DiffWordToken {
  type: "added" | "removed" | "unchanged"
  value: string
}

export interface DiffLineChange {
  type: "added" | "removed" | "unchanged"
  oldLineNumber?: number
  newLineNumber?: number
  content: string
  wordTokens?: DiffWordToken[]
}

export interface ReviewHunkView extends DiffHunkRecord {
  lineChanges: DiffLineChange[]
}

export interface DiffComputeResult {
  hunks: ReviewHunkView[]
  stats: {
    additions: number
    deletions: number
    unmodified: number
  }
}
