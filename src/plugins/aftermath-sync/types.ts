import type {
  PatchChangeType,
  PatchStatus,
  AftermathPatchRecord,
} from "../../ports/aftermathRepository"

export type { PatchChangeType, PatchStatus, AftermathPatchRecord }

export interface EntityCandidate {
  id: string
  name: string
  category: "character" | "item" | "faction"
  currentTier?: string
  currentOwner?: string
}

export interface AftermathAnalysisResult {
  chapterId: string
  patches: Omit<AftermathPatchRecord, "id" | "projectId" | "createdAt" | "status">[]
  summary: {
    attributeUpdates: number
    relations: number
    ownershipTransfers: number
  }
}
