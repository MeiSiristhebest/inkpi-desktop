import type { PovSnapshotRecord, CharacterKnowledge, SecretItem } from "../../ports/povGuardRepository"

export type { PovSnapshotRecord, CharacterKnowledge, SecretItem }

export interface EpistemicFact {
  factId: string
  factText: string
  associatedEntityId?: string
  secrecyLevel: "low" | "secret" | "top_secret"
}

export interface PovViolation {
  id: string
  type: "head_hopping" | "omniscience_leak" | "out_of_field_perception"
  paragraphIndex: number
  characterName: string
  snippet: string
  explanation: string
  suggestedFix?: string
}

export interface PovAnalysisResult {
  povCharacter: string
  povMode: "first_person" | "third_limited" | "third_objective" | "omniscient"
  totalParagraphs: number
  headHoppingCount: number
  leakageCount: number
  violations: PovViolation[]
  sanitizedTextMask: string
}
